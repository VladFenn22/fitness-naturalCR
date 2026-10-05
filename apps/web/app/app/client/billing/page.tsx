import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

type SubResponse = {
    ok?: boolean;
    active?: boolean;
    status?: string;
    currentPeriodEnd?: string | null;
};

async function getSub(userId: string): Promise<SubResponse> {
    const api = process.env.NEXT_PUBLIC_API_URL!;
    try {
        const r = await fetch(`${api}/me/subscription?userId=${encodeURIComponent(userId)}`, {
            cache: "no-store",
        });
        return (await r.json()) as SubResponse;
    } catch {
        return { ok: false, active: false, status: "none" };
    }
}

const PLANES = [
    {
        key: "basic",
        name: "Base",
        price: "₡15.000",
        items: [
            "Rutina de entrenamiento estructurada",
            "Plan nutricional por plazo",
            "Descarga de ambos en PDF",
            "Coach asignado",
        ],
    },
    {
        key: "coaching",
        name: "Coaching Completo",
        price: "₡20.000",
        featured: true,
        items: [
            "Todo lo del plan Base",
            "Revisión y ajuste de la rutina por fase",
            "Plan nutricional con objetivos de macros",
            "Renovación del plan al vencer el plazo",
        ],
    },
    {
        key: "competition",
        name: "Competencia Natural",
        price: "₡25.000",
        items: [
            "Todo lo del Coaching Completo",
            "Planificación orientada a tarima",
            "Ajustes más frecuentes según la etapa",
        ],
    },
];

const ESTADOS: Record<string, { label: string; clase: string }> = {
    active: { label: "Activa", clase: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
    trialing: { label: "En periodo de prueba", clase: "bg-sky-50 text-sky-700 ring-sky-200" },
    past_due: { label: "Pago pendiente", clase: "bg-amber-50 text-amber-700 ring-amber-200" },
    canceled: { label: "Cancelada", clase: "bg-red-50 text-red-700 ring-red-200" },
    none: { label: "Sin suscripción", clase: "bg-slate-100 text-slate-600 ring-slate-200" },
};

export default async function BillingPage({
    searchParams,
}: {
    searchParams: Promise<{ canceled?: string; success?: string }>;
}) {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const sp = await searchParams;
    const j = await getSub(userId);

    const active = Boolean(j?.ok && j?.active);
    const status = String(j?.status ?? "none");
    const estado = ESTADOS[status] ?? ESTADOS.none;
    const periodEnd = j?.currentPeriodEnd
        ? new Date(j.currentPeriodEnd).toLocaleDateString("es-CR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        })
        : null;

    const showCanceled = sp.canceled === "1" || sp.canceled === "true";
    const showSuccess = sp.success === "1" || sp.success === "true";

    return (
        <main className="space-y-6">
            {showSuccess ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="text-sm font-semibold text-emerald-900">Pago confirmado</div>
                    <p className="mt-1 text-sm text-emerald-800">
                        Tu suscripción quedó activa. Ya podés ver tu rutina y tu plan nutricional.
                    </p>
                </div>
            ) : null}

            {showCanceled ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="text-sm font-semibold text-amber-900">Pago cancelado</div>
                    <p className="mt-1 text-sm text-amber-800">
                        No se completó el cobro. Podés intentarlo de nuevo cuando quieras.
                    </p>
                </div>
            ) : null}

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold text-slate-900">Suscripción & pagos</h1>
                        <p className="mt-1 text-sm text-slate-600">
                            Tu suscripción habilita el acceso a la rutina y al plan nutricional.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${estado.clase}`}
                        >
                            {estado.label}
                        </span>
                        {active ? (
                            <Link
                                href="/app/client"
                                className="inline-flex items-center justify-center rounded-xl bg-[#0B2A6F] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
                            >
                                Ir a mi panel
                            </Link>
                        ) : null}
                    </div>
                </div>

                {periodEnd ? (
                    <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                        {active
                            ? `Tu suscripción se renueva el ${periodEnd}.`
                            : `Tu acceso estuvo vigente hasta el ${periodEnd}.`}
                    </p>
                ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                {PLANES.map((p) => (
                    <div
                        key={p.key}
                        className={`flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${p.featured
                            ? "border-[#0B2A6F] ring-1 ring-[#0B2A6F]/20"
                            : "border-slate-200"
                            }`}
                    >
                        {p.featured ? (
                            <span className="mb-3 inline-flex w-fit rounded-full bg-[#0B2A6F]/10 px-2 py-1 text-xs font-semibold text-[#0B2A6F]">
                                Más elegido
                            </span>
                        ) : null}

                        <h2 className="text-lg font-semibold text-slate-900">{p.name}</h2>
                        <div className="mt-1">
                            <span className="text-2xl font-bold text-slate-900">{p.price}</span>
                            <span className="text-sm text-slate-500"> /mes</span>
                        </div>

                        <ul className="mt-4 flex-1 space-y-2">
                            {p.items.map((it) => (
                                <li key={it} className="flex gap-2 text-sm text-slate-600">
                                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0B2A6F]" />
                                    {it}
                                </li>
                            ))}
                        </ul>

                        <form action="/api/checkout" method="POST" className="mt-6">
                            <input type="hidden" name="plan" value={p.key} />
                            <button
                                type="submit"
                                className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold ${p.featured
                                    ? "bg-[#0B2A6F] text-white hover:opacity-95"
                                    : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                                    }`}
                            >
                                {active ? "Cambiar a este plan" : "Activar este plan"}
                            </button>
                        </form>
                    </div>
                ))}
            </div>

            <p className="text-xs text-slate-500">
                Los pagos se procesan de forma segura con Stripe. Podés cancelar cuando quieras; el
                acceso se mantiene hasta el final del periodo ya pagado.
            </p>
        </main>
    );
}
