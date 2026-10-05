import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getCurrentEmail, isCoachEmail } from "@/lib/auth";

type ClientRow = {
    id: string;
    clerkUserId: string;
    nombre: string | null;
    email: string | null;
    meta: string | null;
    experiencia: string | null;
    disponibilidad: string | null;
    coach: { id: string; name: string | null } | null;
    trainingPlans: Array<{ id: string; title: string; updatedAt: string }>;
};

async function fetchClients(): Promise<ClientRow[]> {
    const api = process.env.NEXT_PUBLIC_API_URL!;
    try {
        const r = await fetch(`${api}/coach/clients`, { cache: "no-store" });
        const j = await r.json();
        return j?.clients ?? [];
    } catch {
        return [];
    }
}

export default async function CoachClientsPage() {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const email = await getCurrentEmail();
    if (!isCoachEmail(email)) {
        return (
            <main className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h1 className="text-xl font-semibold text-slate-900">Acceso restringido</h1>
                <p className="mt-2 text-sm text-slate-600">
                    Tu usuario no está habilitado como coach. Agregalo en <code>COACH_EMAILS</code>.
                </p>
            </main>
        );
    }

    const clients = await fetchClients();

    return (
        <main className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-semibold text-slate-900">Clientes</h1>
                        <p className="mt-1 text-sm text-slate-600">
                            Abrí el detalle de un cliente para crear o editar su rutina.
                        </p>
                    </div>
                    <div className="text-xs font-semibold text-slate-500">
                        Total: <span className="text-slate-900">{clients.length}</span>
                    </div>
                </div>
            </div>

            {clients.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-sm text-slate-600">
                        Todavía no hay clientes registrados. Aprobá un lead para generar su invitación.
                    </p>
                    <Link
                        href="/app/coach/leads"
                        className="mt-3 inline-block text-sm font-semibold text-[#0B2A6F] hover:underline"
                    >
                        Ir a leads →
                    </Link>
                </div>
            ) : (
                <div className="grid gap-4">
                    {clients.map((c) => {
                        const plan = c.trainingPlans?.[0];
                        return (
                            <div
                                key={c.id}
                                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                            >
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div>
                                        <div className="text-base font-semibold text-slate-900">
                                            {c.nombre ?? c.email ?? c.clerkUserId}
                                        </div>
                                        <div className="mt-1 text-xs text-slate-500">{c.email ?? "—"}</div>
                                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                                            <span>Objetivo: {c.meta ?? "—"}</span>
                                            <span>Nivel: {c.experiencia ?? "—"}</span>
                                            <span>Días: {c.disponibilidad ?? "—"}</span>
                                            <span>Coach: {c.coach?.name ?? "sin asignar"}</span>
                                        </div>
                                        <div className="mt-2 text-xs">
                                            {plan ? (
                                                <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">
                                                    Rutina activa: {plan.title}
                                                </span>
                                            ) : (
                                                <span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-700">
                                                    Sin rutina activa
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <Link
                                        href={`/app/coach/clients/${encodeURIComponent(c.clerkUserId)}`}
                                        className="inline-flex items-center justify-center rounded-xl bg-[#0B2A6F] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
                                    >
                                        Abrir detalle
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </main>
    );
}
