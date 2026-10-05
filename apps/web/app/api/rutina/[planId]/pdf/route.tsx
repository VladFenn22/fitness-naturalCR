import { auth } from "@clerk/nextjs/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { RutinaPdfDocument } from "@/lib/rutina-pdf";
import { getCurrentEmail, hasActiveSubscription, isCoachEmail } from "@/lib/auth";
import type { RutinaCliente, RutinaPlan } from "@/lib/rutina";

export const runtime = "nodejs";

type PlanResponse = {
    ok: boolean;
    plan?: RutinaPlan & { client: RutinaCliente & { clerkUserId: string } };
};

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ planId: string }> }
) {
    const { userId } = await auth();
    if (!userId) return new Response("Unauthorized", { status: 401 });

    const { planId } = await params;

    const api = process.env.NEXT_PUBLIC_API_URL!;
    const r = await fetch(`${api}/training-plans/${encodeURIComponent(planId)}`, {
        cache: "no-store",
    });

    if (!r.ok) return new Response("Rutina no encontrada", { status: 404 });

    const j = (await r.json()) as PlanResponse;
    const plan = j?.plan;
    if (!j?.ok || !plan) return new Response("Rutina no encontrada", { status: 404 });

    // Regla de acceso transversal: el coach/admin puede descargar siempre;
    // el cliente solo su propia rutina y con la suscripción al día.
    const esDueno = plan.client.clerkUserId === userId;
    const email = await getCurrentEmail();
    const esStaff = Boolean(process.env.COACH_EMAILS || process.env.ADMIN_EMAILS) && isCoachEmail(email);

    if (!esDueno && !esStaff) return new Response("Forbidden", { status: 403 });

    if (esDueno && !esStaff) {
        const activa = await hasActiveSubscription(userId);
        if (!activa) return new Response("Suscripción inactiva", { status: 402 });
    }

    const buffer = await renderToBuffer(
        <RutinaPdfDocument plan={plan} client={plan.client} />
    );

    const fileName = `rutina-${plan.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;

    return new Response(new Uint8Array(buffer), {
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${fileName}"`,
            "Cache-Control": "no-store",
        },
    });
}
