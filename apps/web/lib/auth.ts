import { currentUser } from "@clerk/nextjs/server";

function parseEmails(raw: string | undefined) {
    return (raw ?? "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
}

export type AppRole = "admin" | "coach" | "client";

export async function getCurrentEmail() {
    const u = await currentUser();
    return u?.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? null;
}

export function isAdminEmail(email: string | null | undefined) {
    const allow = parseEmails(process.env.ADMIN_EMAILS);
    if (allow.length === 0) return false;
    return email ? allow.includes(email.toLowerCase()) : false;
}

export function isCoachEmail(email: string | null | undefined) {
    const allow = [...parseEmails(process.env.COACH_EMAILS), ...parseEmails(process.env.ADMIN_EMAILS)];
    // MVP: si no se configura nada, no se bloquea el panel de coach
    if (allow.length === 0) return true;
    return email ? allow.includes(email.toLowerCase()) : false;
}

export async function getCurrentRole(): Promise<AppRole> {
    const email = await getCurrentEmail();
    if (isAdminEmail(email)) return "admin";
    if (parseEmails(process.env.COACH_EMAILS).length > 0 && isCoachEmail(email)) return "coach";
    return "client";
}

export async function hasActiveSubscription(userId: string) {
    const api = process.env.NEXT_PUBLIC_API_URL!;
    try {
        const r = await fetch(`${api}/me/subscription?userId=${encodeURIComponent(userId)}`, {
            cache: "no-store",
        });
        const j = await r.json();
        return Boolean(j?.ok && j?.active);
    } catch {
        return false;
    }
}
