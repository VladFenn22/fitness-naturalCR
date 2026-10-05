import { auth } from "@clerk/nextjs/server";
import { getCurrentEmail, isCoachEmail } from "@/lib/auth";

export async function POST(req: Request) {
    const { userId } = await auth();
    if (!userId) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const email = await getCurrentEmail();
    if (!isCoachEmail(email)) {
        return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const { planId } = (await req.json()) ?? {};
    if (!planId) return Response.json({ ok: false, error: "invalid_payload" }, { status: 400 });

    const api = process.env.NEXT_PUBLIC_API_URL!;
    const r = await fetch(
        `${api}/coach/training-plans/${encodeURIComponent(planId)}/activate`,
        { method: "PATCH", cache: "no-store" }
    );

    const j = await r.json().catch(() => ({ ok: false, error: "bad_response" }));
    return Response.json(j, { status: r.status });
}
