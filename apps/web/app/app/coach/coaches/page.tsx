import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getCurrentEmail, isAdminEmail, isCoachEmail } from "@/lib/auth";
import CoachesManager from "./CoachesManager";

export type CoachRow = {
    id: string;
    clerkUserId: string;
    name: string | null;
    email: string | null;
    bio: string | null;
    isActive: boolean;
    _count?: { clients: number };
};

async function fetchCoaches(): Promise<CoachRow[]> {
    const api = process.env.NEXT_PUBLIC_API_URL!;
    try {
        const r = await fetch(`${api}/admin/coaches`, { cache: "no-store" });
        const j = await r.json();
        return j?.coaches ?? [];
    } catch {
        return [];
    }
}

export default async function CoachesPage() {
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

    const puedeEditar = isAdminEmail(email);
    const coaches = await fetchCoaches();

    return (
        <main className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h1 className="text-2xl font-semibold text-slate-900">Coaches</h1>
                <p className="mt-1 text-sm text-slate-600">
                    {puedeEditar
                        ? "Dá de alta coaches y activá o desactivá su acceso."
                        : "Solo un administrador puede crear o editar coaches."}
                </p>
            </div>

            <CoachesManager coaches={coaches} puedeEditar={puedeEditar} />
        </main>
    );
}
