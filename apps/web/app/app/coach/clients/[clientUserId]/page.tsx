import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentEmail, isCoachEmail } from "@/lib/auth";
import type { RutinaPlan } from "@/lib/rutina";
import type { NutricionPlan } from "@/lib/nutricion";
import RutinaEditor from "./RutinaEditor";
import NutricionEditor from "./NutricionEditor";

type ClientDetail = {
    id: string;
    clerkUserId: string;
    nombre: string | null;
    email: string | null;
    meta: string | null;
    experiencia: string | null;
    disponibilidad: string | null;
    lesiones: string | null;
    coach: { id: string; name: string | null; email: string | null } | null;
    trainingPlans: RutinaPlan[];
    nutritionPlans: NutricionPlan[];
};

async function fetchClient(clientUserId: string): Promise<ClientDetail | null> {
    const api = process.env.NEXT_PUBLIC_API_URL!;
    try {
        const r = await fetch(`${api}/coach/clients/${encodeURIComponent(clientUserId)}`, {
            cache: "no-store",
        });
        if (!r.ok) return null;
        const j = await r.json();
        return j?.client ?? null;
    } catch {
        return null;
    }
}

export default async function CoachClientDetailPage({
    params,
}: {
    params: Promise<{ clientUserId: string }>;
}) {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const email = await getCurrentEmail();
    if (!isCoachEmail(email)) {
        return (
            <main className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h1 className="text-xl font-semibold text-slate-900">Acceso restringido</h1>
            </main>
        );
    }

    const { clientUserId } = await params;
    const client = await fetchClient(clientUserId);

    if (!client) {
        return (
            <main className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h1 className="text-xl font-semibold text-slate-900">Cliente no encontrado</h1>
                <Link
                    href="/app/coach/clients"
                    className="mt-3 inline-block text-sm font-semibold text-[#0B2A6F] hover:underline"
                >
                    ← Volver a clientes
                </Link>
            </main>
        );
    }

    return (
        <main className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <Link
                    href="/app/coach/clients"
                    className="text-xs font-semibold text-slate-500 hover:underline"
                >
                    ← Clientes
                </Link>
                <h1 className="mt-2 text-2xl font-semibold text-slate-900">
                    {client.nombre ?? client.email ?? client.clerkUserId}
                </h1>
                <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    <div>Correo: {client.email ?? "—"}</div>
                    <div>Coach: {client.coach?.name ?? "sin asignar"}</div>
                    <div>Objetivo: {client.meta ?? "—"}</div>
                    <div>Experiencia: {client.experiencia ?? "—"}</div>
                    <div>Disponibilidad: {client.disponibilidad ?? "—"}</div>
                    <div>Lesiones: {client.lesiones ?? "—"}</div>
                </div>
            </div>

            <RutinaEditor clientUserId={client.clerkUserId} planes={client.trainingPlans ?? []} />

            <NutricionEditor
                clientUserId={client.clerkUserId}
                planes={client.nutritionPlans ?? []}
            />
        </main>
    );
}
