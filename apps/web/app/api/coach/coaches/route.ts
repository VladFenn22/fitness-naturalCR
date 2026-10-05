import { auth } from "@clerk/nextjs/server";
import { getCurrentEmail, isAdminEmail } from "@/lib/auth";

export async function POST(req: Request) {
    const { userId } = await auth();
    if (!userId) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const email = await getCurrentEmail();
    if (!isAdminEmail(email)) {
        return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const api = process.env.NEXT_PUBLIC_API_URL!;

    if (body?.action === "update") {
        const { id, ...patch } = body;
        if (!id) return Response.json({ ok: false, error: "invalid_payload" }, { status: 400 });
        const r = await fetch(`${api}/admin/coaches/${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
            cache: "no-store",
        });
        const j = await r.json().catch(() => ({ ok: false, error: "bad_response" }));
        return Response.json(j, { status: r.status });
    }

    const { clerkUserId, name, email: coachEmail, bio } = body ?? {};
    if (!clerkUserId || !name) {
        return Response.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const r = await fetch(`${api}/admin/coaches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerkUserId, name, email: coachEmail, bio }),
        cache: "no-store",
    });
    const j = await r.json().catch(() => ({ ok: false, error: "bad_response" }));
    return Response.json(j, { status: r.status });
}
