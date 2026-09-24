import "dotenv/config";
import express from "express";
import cors from "cors";
import { prisma } from "./prisma";
import { stripe } from "./stripe";
import crypto from "crypto";

function makeInviteToken() {
    return crypto.randomBytes(24).toString("hex");
}

const app = express();
app.use(cors());

// ✅ 1) WEBHOOK STRIPE (RAW BODY) — ANTES de express.json()
app.post("/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"];

    try {
        const event = stripe.webhooks.constructEvent(
            req.body,
            sig as string,
            process.env.STRIPE_WEBHOOK_SECRET!
        );

        if (event.type === "checkout.session.completed") {
            const session = event.data.object as any;

            const clerkUserId = session?.metadata?.clerkUserId;
            const subscriptionId = session?.subscription;

            if (clerkUserId && subscriptionId) {
                const sub = await stripe.subscriptions.retrieve(String(subscriptionId)) as any;

                const currentPeriodEndUnix = sub?.current_period_end;
                const currentPeriodEnd =
                    typeof currentPeriodEndUnix === "number" && Number.isFinite(currentPeriodEndUnix)
                        ? new Date(currentPeriodEndUnix * 1000)
                        : null;

                await prisma.subscription.upsert({
                    where: { stripeSubscriptionId: String(sub.id) },
                    update: {
                        userId: clerkUserId,
                        status: String(sub.status),
                        stripeCustomerId: sub.customer ? String(sub.customer) : null,
                        currentPeriodEnd,
                    },
                    create: {
                        userId: clerkUserId,
                        status: String(sub.status),
                        stripeCustomerId: sub.customer ? String(sub.customer) : null,
                        stripeSubscriptionId: String(sub.id),
                        currentPeriodEnd,
                    },
                });
            }
        }

        return res.json({ received: true });
    } catch (err: any) {
        console.error("STRIPE_WEBHOOK_ERROR:", err?.message ?? err);
        return res.status(400).send(`Webhook Error: ${err?.message ?? "unknown"}`);
    }
});

app.use(express.json());

app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "api" });
});

// ══════════════════════════════════════════════════════════════════════════════
// LEADS (ya existente)
// ══════════════════════════════════════════════════════════════════════════════

app.post("/admin/leads/:id/approve", async (req, res) => {
    try {
        const leadId = String(req.params.id);
        const token = makeInviteToken();

        const lead = await prisma.lead.update({
            where: { id: leadId },
            data: {
                status: "APPROVED",
                inviteToken: token,
                approvedAt: new Date(),
            },
        });

        const webBase = process.env.WEB_BASE_URL || "http://localhost:3000";
        const redirectTo = `/onboarding?token=${encodeURIComponent(token)}`;
        const inviteUrl = `${webBase}/sign-up?redirect_url=${encodeURIComponent(redirectTo)}`;

        return res.json({ ok: true, lead, inviteUrl });
    } catch (e: any) {
        console.error("APPROVE_LEAD_ERROR:", e);
        return res.status(500).json({ ok: false, error: "approve_failed" });
    }
});

app.get("/admin/leads", async (_req, res) => {
    try {
        const leads = await prisma.lead.findMany({
            orderBy: { createdAt: "desc" },
            take: 200,
            select: {
                id: true,
                createdAt: true,
                nombre: true,
                email: true,
                whatsapp: true,
                objetivo: true,
                experiencia: true,
                disponibilidad: true,
                lesiones: true,
                mensaje: true,
                source: true,
                status: true,
                inviteToken: true,
                approvedAt: true,
                invitedAt: true,
            },
        });

        const webBase = process.env.WEB_BASE_URL || "http://localhost:3000";

        const withUrl = leads.map((l) => ({
            ...l,
            inviteUrl: l.inviteToken
                ? `${webBase}/sign-up?redirect_url=${encodeURIComponent(`/onboarding?token=${encodeURIComponent(l.inviteToken)}`)}`
                : null,
        }));

        return res.json({ ok: true, leads: withUrl });
    } catch (e) {
        console.error("ADMIN_LEADS_ERROR:", e);
        return res.status(500).json({ ok: false, error: "admin_leads_failed" });
    }
});

app.post("/invites/redeem", async (req, res) => {
    try {
        const { token, userId } = req.body as { token?: string; userId?: string };
        if (!token || !userId) return res.status(400).json({ ok: false, error: "missing" });

        const lead = await prisma.lead.findUnique({ where: { inviteToken: token } });
        if (!lead) return res.status(404).json({ ok: false, error: "invalid_token" });

        if (lead.status === "REDEEMED") return res.json({ ok: true, alreadyRedeemed: true });

        if (lead.status !== "APPROVED") {
            return res.status(400).json({ ok: false, error: "not_approved", status: lead.status });
        }

        await prisma.lead.update({
            where: { id: lead.id },
            data: { status: "REDEEMED" },
        });

        return res.json({ ok: true, redeemed: true });
    } catch (e) {
        console.error("REDEEM_INVITE_ERROR:", e);
        const message = e instanceof Error ? e.message : typeof e === "string" ? e : "unknown_error";
        return res.status(500).json({ ok: false, error: "redeem_failed", message });
    }
});

app.post("/leads", async (req, res) => {
    try {
        const { nombre, email, whatsapp, objetivo, experiencia, disponibilidad, lesiones, mensaje } = req.body ?? {};

        if (!nombre || typeof nombre !== "string" || nombre.trim().length < 2) {
            return res.status(400).json({ ok: false, error: "Nombre inválido" });
        }
        if (!email || typeof email !== "string" || !email.includes("@")) {
            return res.status(400).json({ ok: false, error: "Email inválido" });
        }
        if (!whatsapp || typeof whatsapp !== "string" || whatsapp.trim().length < 8) {
            return res.status(400).json({ ok: false, error: "WhatsApp inválido" });
        }

        const lead = await prisma.lead.create({
            data: {
                nombre: nombre.trim(),
                email: email.trim().toLowerCase(),
                whatsapp: whatsapp.trim(),
                objetivo: String(objetivo ?? "unknown"),
                experiencia: String(experiencia ?? "unknown"),
                disponibilidad: String(disponibilidad ?? "unknown"),
                lesiones: lesiones ? String(lesiones) : null,
                mensaje: mensaje ? String(mensaje) : null,
                source: "web",
            },
        });

        return res.json({ ok: true, leadId: lead.id });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ ok: false, error: "Error guardando lead" });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// BILLING (ya existente)
// ══════════════════════════════════════════════════════════════════════════════

app.post("/billing/checkout", async (req, res) => {
    try {
        const { clerkUserId, plan } = req.body ?? {};

        if (!clerkUserId || typeof clerkUserId !== "string") {
            return res.status(400).json({ ok: false, error: "Missing clerkUserId" });
        }

        const priceMap: Record<string, string | undefined> = {
            basic: process.env.STRIPE_PRICE_BASIC,
            coaching: process.env.STRIPE_PRICE_COACHING,
            competition: process.env.STRIPE_PRICE_COMPETITION,
        };

        const chosenPlan = typeof plan === "string" ? plan : "coaching";
        const priceId = priceMap[chosenPlan];

        if (!priceId) {
            return res.status(400).json({ ok: false, error: `Invalid plan: ${chosenPlan}` });
        }

        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${process.env.APP_BASE_URL}/app/client?success=1`,
            cancel_url: `${process.env.APP_BASE_URL}/client/billing?canceled=1`,
            metadata: { clerkUserId, plan: chosenPlan },
        });

        return res.json({ ok: true, url: session.url });
    } catch (err: any) {
        console.error("CHECKOUT_ERROR:", err?.message ?? err);
        return res.status(500).json({ ok: false, error: "Checkout error" });
    }
});

app.get("/me/subscription", async (req, res) => {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ ok: false, error: "Missing userId" });

    const sub = await prisma.subscription.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
    });

    const active = sub?.status === "active" || sub?.status === "trialing";

    return res.json({
        ok: true,
        active: Boolean(active),
        status: sub?.status ?? "none",
        currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// 2) PERFIL DEL CLIENTE (ya existente + preferencias de notificación)
// ══════════════════════════════════════════════════════════════════════════════

app.get("/me/profile", async (req, res) => {
    try {
        const userId = String(req.query.userId || "");
        if (!userId) return res.status(400).json({ ok: false, error: "missing_userId" });

        const profile = await prisma.clientProfile.findUnique({
            where: { clerkUserId: userId },
        });

        return res.json({ ok: true, profile });
    } catch (e) {
        console.error("GET_PROFILE_ERROR:", e);
        return res.status(500).json({ ok: false, error: "get_profile_failed" });
    }
});

app.post("/me/profile", async (req, res) => {
    try {
        const {
            userId,
            alturaCm,
            pesoKg,
            meta,
            experiencia,
            lesiones,
            disponibilidad,
            notifyEmail,
            notifyPush,
            notifyWhatsApp,
        } = req.body as {
            userId?: string;
            alturaCm?: number | string;
            pesoKg?: number | string;
            meta?: string;
            experiencia?: string;
            lesiones?: string;
            disponibilidad?: string;
            notifyEmail?: boolean;
            notifyPush?: boolean;
            notifyWhatsApp?: boolean;
        };

        if (!userId) return res.status(400).json({ ok: false, error: "missing_userId" });

        const altura = alturaCm === "" || alturaCm == null ? null : Number(alturaCm);
        const peso = pesoKg === "" || pesoKg == null ? null : Number(pesoKg);

        const profile = await prisma.clientProfile.upsert({
            where: { clerkUserId: userId },
            update: {
                alturaCm: Number.isFinite(altura) ? Math.round(altura as number) : null,
                pesoKg: Number.isFinite(peso) ? peso : null,
                meta: meta ?? null,
                experiencia: experiencia ?? null,
                lesiones: lesiones ?? null,
                disponibilidad: disponibilidad ?? null,
                notifyEmail: notifyEmail ?? undefined,
                notifyPush: notifyPush ?? undefined,
                notifyWhatsApp: notifyWhatsApp ?? undefined,
            },
            create: {
                clerkUserId: userId,
                alturaCm: Number.isFinite(altura) ? Math.round(altura as number) : null,
                pesoKg: Number.isFinite(peso) ? peso : null,
                meta: meta ?? null,
                experiencia: experiencia ?? null,
                lesiones: lesiones ?? null,
                disponibilidad: disponibilidad ?? null,
                notifyEmail: notifyEmail ?? true,
                notifyPush: notifyPush ?? true,
                notifyWhatsApp: notifyWhatsApp ?? false,
            },
        });

        return res.json({ ok: true, profile });
    } catch (e) {
        console.error("UPSERT_PROFILE_ERROR:", e);
        return res.status(500).json({ ok: false, error: "upsert_profile_failed" });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// 3) PLANES DE ENTRENAMIENTO + WORKOUT LOGS
// ══════════════════════════════════════════════════════════════════════════════

app.get("/me/training-plan/active", async (req, res) => {
    try {
        const userId = String(req.query.userId || "");
        if (!userId) return res.status(400).json({ ok: false, error: "missing_userId" });

        const client = await prisma.clientProfile.findUnique({
            where: { clerkUserId: userId },
            select: { id: true },
        });

        if (!client) return res.status(404).json({ ok: false, error: "profile_not_found" });

        const plan = await prisma.trainingPlan.findFirst({
            where: { clientId: client.id, isActive: true },
            orderBy: { createdAt: "desc" },
            include: {
                days: {
                    orderBy: [{ order: "asc" }, { dayOfWeek: "asc" }],
                    include: { exercises: { orderBy: { order: "asc" } } },
                },
            },
        });

        return res.json({ ok: true, plan });
    } catch (e) {
        console.error("GET_ACTIVE_TRAINING_PLAN_ERROR:", e);
        return res.status(500).json({ ok: false, error: "get_active_training_plan_failed" });
    }
});

app.post("/coach/clients/:clientUserId/training-plans", async (req, res) => {
    try {
        const clientUserId = String(req.params.clientUserId || "");
        if (!clientUserId) return res.status(400).json({ ok: false, error: "missing_clientUserId" });

        const { title, startDate, endDate, days } = req.body as {
            title?: string;
            startDate?: string | null;
            endDate?: string | null;
            days?: Array<{
                dayOfWeek: number;
                name?: string | null;
                notes?: string | null;
                order?: number;
                exercises?: Array<{
                    name: string;
                    sets?: number | null;
                    reps?: string | null;
                    rir?: string | null;
                    restSec?: number | null;
                    tempo?: string | null;
                    notes?: string | null;
                    order?: number;
                }>;
            }>;
        };

        if (!title || typeof title !== "string" || title.trim().length < 2) {
            return res.status(400).json({ ok: false, error: "invalid_title" });
        }
        if (!Array.isArray(days) || days.length === 0) {
            return res.status(400).json({ ok: false, error: "missing_days" });
        }

        const client = await prisma.clientProfile.findUnique({
            where: { clerkUserId: clientUserId },
            select: { id: true },
        });

        if (!client) return res.status(404).json({ ok: false, error: "profile_not_found" });

        const created = await prisma.$transaction(async (tx) => {
            await tx.trainingPlan.updateMany({
                where: { clientId: client.id, isActive: true },
                data: { isActive: false },
            });

            return tx.trainingPlan.create({
                data: {
                    clientId: client.id,
                    title: title.trim(),
                    isActive: true,
                    startDate: startDate ? new Date(startDate) : null,
                    endDate: endDate ? new Date(endDate) : null,
                    days: {
                        create: days.map((d, i) => ({
                            dayOfWeek: Number(d.dayOfWeek),
                            name: d.name ?? null,
                            notes: d.notes ?? null,
                            order: Number.isFinite(d.order as number) ? Number(d.order) : i,
                            exercises: {
                                create: (d.exercises ?? []).map((ex, j) => ({
                                    name: String(ex.name).trim(),
                                    sets: ex.sets == null ? null : Number(ex.sets),
                                    reps: ex.reps ?? null,
                                    rir: ex.rir ?? null,
                                    restSec: ex.restSec == null ? null : Number(ex.restSec),
                                    tempo: ex.tempo ?? null,
                                    notes: ex.notes ?? null,
                                    order: Number.isFinite(ex.order as number) ? Number(ex.order) : j,
                                })),
                            },
                        })),
                    },
                },
                include: {
                    days: {
                        orderBy: [{ order: "asc" }, { dayOfWeek: "asc" }],
                        include: { exercises: { orderBy: { order: "asc" } } },
                    },
                },
            });
        });

        return res.json({ ok: true, plan: created });
    } catch (e) {
        console.error("CREATE_TRAINING_PLAN_ERROR:", e);
        return res.status(500).json({ ok: false, error: "create_training_plan_failed" });
    }
});

// ✅ Registrar workout (cliente marca completado + series)
app.post("/me/workout-logs", async (req, res) => {
    try {
        const { userId, dayOfWeek, notes, completed, sets } = req.body;
        if (!userId) return res.status(400).json({ ok: false, error: "missing_userId" });

        const client = await prisma.clientProfile.findUnique({
            where: { clerkUserId: userId },
            select: { id: true },
        });

        if (!client) return res.status(404).json({ ok: false, error: "profile_not_found" });

        const log = await prisma.workoutLog.create({
            data: {
                clientId: client.id,
                dayOfWeek: dayOfWeek ?? null,
                notes: notes ?? null,
                completed: completed ?? false,
                sets: {
                    create: (sets ?? []).map((s) => ({
                        exerciseId: s.exerciseId ?? null,
                        exerciseName: s.exerciseName,
                        setNumber: s.setNumber,
                        weightKg: s.weightKg ?? null,
                        reps: s.reps ?? null,
                        rpe: s.rpe ?? null,
                        rir: s.rir ?? null,
                        notes: s.notes ?? null,
                    })),
                },
            },
            include: { sets: true },
        });

        return res.json({ ok: true, log });
    } catch (e) {
        console.error("CREATE_WORKOUT_LOG_ERROR:", e);
        return res.status(500).json({ ok: false, error: "create_workout_log_failed" });
    }
});

// ✅ Historial de workouts
app.get("/me/workout-logs", async (req, res) => {
    try {
        const userId = String(req.query.userId || "");
        const limit = Math.min(Number(req.query.limit) || 30, 100);

        if (!userId) return res.status(400).json({ ok: false, error: "missing_userId" });

        const client = await prisma.clientProfile.findUnique({
            where: { clerkUserId: userId },
            select: { id: true },
        });

        if (!client) return res.status(404).json({ ok: false, error: "profile_not_found" });

        const logs = await prisma.workoutLog.findMany({
            where: { clientId: client.id },
            orderBy: { date: "desc" },
            take: limit,
            include: { sets: { orderBy: { setNumber: "asc" } } },
        });

        return res.json({ ok: true, logs });
    } catch (e) {
        console.error("GET_WORKOUT_LOGS_ERROR:", e);
        return res.status(500).json({ ok: false, error: "get_workout_logs_failed" });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// 4) MACROS Y NUTRICIÓN
// ══════════════════════════════════════════════════════════════════════════════

// ✅ Obtener macro target activo
app.get("/me/macro-target", async (req, res) => {
    try {
        const userId = String(req.query.userId || "");
        if (!userId) return res.status(400).json({ ok: false, error: "missing_userId" });

        const client = await prisma.clientProfile.findUnique({
            where: { clerkUserId: userId },
            select: { id: true },
        });

        if (!client) return res.status(404).json({ ok: false, error: "profile_not_found" });

        const target = await prisma.macroTarget.findFirst({
            where: { clientId: client.id, isActive: true },
            orderBy: { createdAt: "desc" },
        });

        return res.json({ ok: true, target });
    } catch (e) {
        console.error("GET_MACRO_TARGET_ERROR:", e);
        return res.status(500).json({ ok: false, error: "get_macro_target_failed" });
    }
});

// ✅ Coach crea macro target para cliente
app.post("/coach/clients/:clientUserId/macro-targets", async (req, res) => {
    try {
        const clientUserId = String(req.params.clientUserId || "");
        const { name, kcal, proteinG, carbsG, fatG, startDate, endDate } = req.body;

        if (!clientUserId) return res.status(400).json({ ok: false, error: "missing_clientUserId" });
        if (!kcal || !proteinG || !carbsG || !fatG) {
            return res.status(400).json({ ok: false, error: "missing_macros" });
        }

        const client = await prisma.clientProfile.findUnique({
            where: { clerkUserId: clientUserId },
            select: { id: true },
        });

        if (!client) return res.status(404).json({ ok: false, error: "profile_not_found" });

        // Desactivar anteriores
        await prisma.macroTarget.updateMany({
            where: { clientId: client.id, isActive: true },
            data: { isActive: false },
        });

        const target = await prisma.macroTarget.create({
            data: {
                clientId: client.id,
                name: name ?? null,
                kcal: Number(kcal),
                proteinG: Number(proteinG),
                carbsG: Number(carbsG),
                fatG: Number(fatG),
                isActive: true,
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
            },
        });

        return res.json({ ok: true, target });
    } catch (e) {
        console.error("CREATE_MACRO_TARGET_ERROR:", e);
        return res.status(500).json({ ok: false, error: "create_macro_target_failed" });
    }
});

// ✅ Cliente registra comida del día
app.post("/me/meal-logs", async (req, res) => {
    try {
        const { userId, date, mealType, kcal, proteinG, carbsG, fatG, adherencePct, notes, foods } = req.body;
        if (!userId) return res.status(400).json({ ok: false, error: "missing_userId" });

        const client = await prisma.clientProfile.findUnique({
            where: { clerkUserId: userId },
            select: { id: true },
        });

        if (!client) return res.status(404).json({ ok: false, error: "profile_not_found" });

        const log = await prisma.mealLog.create({
            data: {
                clientId: client.id,
                date: date ? new Date(date) : new Date(),
                mealType: mealType ?? null,
                kcal: kcal ?? null,
                proteinG: proteinG ?? null,
                carbsG: carbsG ?? null,
                fatG: fatG ?? null,
                adherencePct: adherencePct ?? null,
                notes: notes ?? null,
                foods: {
                    create: (foods ?? []).map((f) => ({
                        name: f.name,
                        quantity: f.quantity ?? null,
                        unit: f.unit ?? null,
                        kcal: f.kcal ?? null,
                        proteinG: f.proteinG ?? null,
                        carbsG: f.carbsG ?? null,
                        fatG: f.fatG ?? null,
                    })),
                },
            },
            include: { foods: true },
        });

        return res.json({ ok: true, log });
    } catch (e) {
        console.error("CREATE_MEAL_LOG_ERROR:", e);
        return res.status(500).json({ ok: false, error: "create_meal_log_failed" });
    }
});

// ✅ Historial de comidas
app.get("/me/meal-logs", async (req, res) => {
    try {
        const userId = String(req.query.userId || "");
        const limit = Math.min(Number(req.query.limit) || 30, 100);
        const dateFrom = req.query.dateFrom ? new Date(String(req.query.dateFrom)) : undefined;
        const dateTo = req.query.dateTo ? new Date(String(req.query.dateTo)) : undefined;

        if (!userId) return res.status(400).json({ ok: false, error: "missing_userId" });

        const client = await prisma.clientProfile.findUnique({
            where: { clerkUserId: userId },
            select: { id: true },
        });

        if (!client) return res.status(404).json({ ok: false, error: "profile_not_found" });

        const logs = await prisma.mealLog.findMany({
            where: {
                clientId: client.id,
                ...(dateFrom || dateTo ? { date: { gte: dateFrom, lte: dateTo } } : {}),
            },
            orderBy: { date: "desc" },
            take: limit,
            include: { foods: true },
        });

        return res.json({ ok: true, logs });
    } catch (e) {
        console.error("GET_MEAL_LOGS_ERROR:", e);
        return res.status(500).json({ ok: false, error: "get_meal_logs_failed" });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// CHECK-INS SEMANALES
// ══════════════════════════════════════════════════════════════════════════════

// ✅ Cliente crea check-in semanal
app.post("/me/check-ins", async (req, res) => {
    try {
        const { userId, weekStart, weightKg, waistCm, sleepAvgHours, stepsAvg, adherencePct, mood, notes, photoUrls } = req.body;

        if (!userId) return res.status(400).json({ ok: false, error: "missing_userId" });
        if (!weekStart) return res.status(400).json({ ok: false, error: "missing_weekStart" });

        const client = await prisma.clientProfile.findUnique({
            where: { clerkUserId: userId },
            select: { id: true },
        });

        if (!client) return res.status(404).json({ ok: false, error: "profile_not_found" });

        const checkIn = await prisma.weeklyCheckIn.upsert({
            where: { clientId_weekStart: { clientId: client.id, weekStart: new Date(weekStart) } },
            update: {
                weightKg: weightKg ?? null,
                waistCm: waistCm ?? null,
                sleepAvgHours: sleepAvgHours ?? null,
                stepsAvg: stepsAvg ?? null,
                adherencePct: adherencePct ?? null,
                mood: mood ?? null,
                notes: notes ?? null,
                photoUrls: photoUrls ?? [],
                status: "SUBMITTED",
            },
            create: {
                clientId: client.id,
                weekStart: new Date(weekStart),
                weightKg: weightKg ?? null,
                waistCm: waistCm ?? null,
                sleepAvgHours: sleepAvgHours ?? null,
                stepsAvg: stepsAvg ?? null,
                adherencePct: adherencePct ?? null,
                mood: mood ?? null,
                notes: notes ?? null,
                photoUrls: photoUrls ?? [],
            },
        });

        return res.json({ ok: true, checkIn });
    } catch (e) {
        console.error("CREATE_CHECKIN_ERROR:", e);
        return res.status(500).json({ ok: false, error: "create_checkin_failed" });
    }
});

// ✅ Historial de check-ins del cliente
app.get("/me/check-ins", async (req, res) => {
    try {
        const userId = String(req.query.userId || "");
        const limit = Math.min(Number(req.query.limit) || 20, 50);

        if (!userId) return res.status(400).json({ ok: false, error: "missing_userId" });

        const client = await prisma.clientProfile.findUnique({
            where: { clerkUserId: userId },
            select: { id: true },
        });

        if (!client) return res.status(404).json({ ok: false, error: "profile_not_found" });

        const checkIns = await prisma.weeklyCheckIn.findMany({
            where: { clientId: client.id },
            orderBy: { weekStart: "desc" },
            take: limit,
            include: { photos: true },
        });

        return res.json({ ok: true, checkIns });
    } catch (e) {
        console.error("GET_CHECKINS_ERROR:", e);
        return res.status(500).json({ ok: false, error: "get_checkins_failed" });
    }
});

// ✅ Coach revisa check-in
app.patch("/coach/check-ins/:id/review", async (req, res) => {
    try {
        const checkInId = String(req.params.id);
        const { coachNotes } = req.body;

        const checkIn = await prisma.weeklyCheckIn.update({
            where: { id: checkInId },
            data: {
                status: "REVIEWED",
                coachNotes: coachNotes ?? null,
            },
        });

        return res.json({ ok: true, checkIn });
    } catch (e) {
        console.error("REVIEW_CHECKIN_ERROR:", e);
        return res.status(500).json({ ok: false, error: "review_checkin_failed" });
    }
});

// ✅ Coach: lista check-ins pendientes
app.get("/coach/check-ins/pending", async (req, res) => {
    try {
        const checkIns = await prisma.weeklyCheckIn.findMany({
            where: { status: "SUBMITTED" },
            orderBy: { createdAt: "asc" },
            take: 50,
            include: {
                client: { select: { clerkUserId: true, meta: true } },
                photos: true,
            },
        });

        return res.json({ ok: true, checkIns });
    } catch (e) {
        console.error("GET_PENDING_CHECKINS_ERROR:", e);
        return res.status(500).json({ ok: false, error: "get_pending_checkins_failed" });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// 6) CHAT (COACH <-> CLIENTE)
// ══════════════════════════════════════════════════════════════════════════════

// ✅ Obtener o crear conversación
app.get("/me/conversation", async (req, res) => {
    try {
        const userId = String(req.query.userId || "");
        if (!userId) return res.status(400).json({ ok: false, error: "missing_userId" });

        const client = await prisma.clientProfile.findUnique({
            where: { clerkUserId: userId },
            select: { id: true },
        });

        if (!client) return res.status(404).json({ ok: false, error: "profile_not_found" });

        let conversation = await prisma.conversation.findUnique({
            where: { clientId: client.id },
            include: {
                messages: {
                    orderBy: { createdAt: "desc" },
                    take: 50,
                },
            },
        });

        if (!conversation) {
            conversation = await prisma.conversation.create({
                data: { clientId: client.id },
                include: { messages: true },
            });
        }

        return res.json({ ok: true, conversation });
    } catch (e) {
        console.error("GET_CONVERSATION_ERROR:", e);
        return res.status(500).json({ ok: false, error: "get_conversation_failed" });
    }
});

// ✅ Enviar mensaje
app.post("/conversations/:conversationId/messages", async (req, res) => {
    try {
        const conversationId = String(req.params.conversationId);
        const { senderId, senderRole, content, type, attachmentUrl } = req.body as {
            senderId: string;
            senderRole: "coach" | "client";
            content: string;
            type?: string;
            attachmentUrl?: string;
        };

        if (!senderId || !senderRole || !content) {
            return res.status(400).json({ ok: false, error: "missing_fields" });
        }

        const message = await prisma.message.create({
            data: {
                conversationId,
                senderId,
                senderRole,
                content,
                type: type ?? "text",
                attachmentUrl: attachmentUrl ?? null,
            },
        });

        // Actualizar lastMessageAt
        await prisma.conversation.update({
            where: { id: conversationId },
            data: { lastMessageAt: new Date() },
        });

        return res.json({ ok: true, message });
    } catch (e) {
        console.error("SEND_MESSAGE_ERROR:", e);
        return res.status(500).json({ ok: false, error: "send_message_failed" });
    }
});

// ✅ Marcar mensajes como vistos
app.patch("/conversations/:conversationId/messages/seen", async (req, res) => {
    try {
        const conversationId = String(req.params.conversationId);
        const { viewerRole } = req.body as { viewerRole: "coach" | "client" };

        // Marcar como vistos los mensajes del otro rol
        const oppositeRole = viewerRole === "coach" ? "client" : "coach";

        await prisma.message.updateMany({
            where: {
                conversationId,
                senderRole: oppositeRole,
                seen: false,
            },
            data: { seen: true, seenAt: new Date() },
        });

        return res.json({ ok: true });
    } catch (e) {
        console.error("MARK_SEEN_ERROR:", e);
        return res.status(500).json({ ok: false, error: "mark_seen_failed" });
    }
});

// ✅ Coach: lista conversaciones con mensajes sin leer
app.get("/coach/conversations", async (req, res) => {
    try {
        const conversations = await prisma.conversation.findMany({
            orderBy: { lastMessageAt: "desc" },
            take: 50,
            include: {
                client: { select: { clerkUserId: true, meta: true } },
                messages: {
                    where: { senderRole: "client", seen: false },
                    select: { id: true },
                },
            },
        });

        const withUnread = conversations.map((c) => ({
            ...c,
            unreadCount: c.messages.length,
            messages: undefined,
        }));

        return res.json({ ok: true, conversations: withUnread });
    } catch (e) {
        console.error("GET_COACH_CONVERSATIONS_ERROR:", e);
        return res.status(500).json({ ok: false, error: "get_coach_conversations_failed" });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// 7) CALENDARIO / CITAS
// ══════════════════════════════════════════════════════════════════════════════

// ✅ Crear cita (coach)
app.post("/coach/appointments", async (req, res) => {
    try {
        const { coachId, clientUserId, type, title, description, startTime, endTime, timezone, notes } = req.body as {
            coachId: string;
            clientUserId: string;
            type: string;
            title?: string;
            description?: string;
            startTime: string;
            endTime?: string;
            timezone?: string;
            notes?: string;
        };

        if (!coachId || !clientUserId || !type || !startTime) {
            return res.status(400).json({ ok: false, error: "missing_fields" });
        }

        const client = await prisma.clientProfile.findUnique({
            where: { clerkUserId: clientUserId },
            select: { id: true },
        });

        if (!client) return res.status(404).json({ ok: false, error: "client_not_found" });

        const appointment = await prisma.appointment.create({
            data: {
                coachId,
                clientId: client.id,
                type,
                title: title ?? null,
                description: description ?? null,
                startTime: new Date(startTime),
                endTime: endTime ? new Date(endTime) : null,
                timezone: timezone ?? "America/Costa_Rica",
                notes: notes ?? null,
            },
        });

        return res.json({ ok: true, appointment });
    } catch (e) {
        console.error("CREATE_APPOINTMENT_ERROR:", e);
        return res.status(500).json({ ok: false, error: "create_appointment_failed" });
    }
});

// ✅ Obtener citas del cliente
app.get("/me/appointments", async (req, res) => {
    try {
        const userId = String(req.query.userId || "");
        const upcoming = req.query.upcoming === "true";

        if (!userId) return res.status(400).json({ ok: false, error: "missing_userId" });

        const client = await prisma.clientProfile.findUnique({
            where: { clerkUserId: userId },
            select: { id: true },
        });

        if (!client) return res.status(404).json({ ok: false, error: "profile_not_found" });

        const appointments = await prisma.appointment.findMany({
            where: {
                clientId: client.id,
                ...(upcoming ? { startTime: { gte: new Date() }, status: "BOOKED" } : {}),
            },
            orderBy: { startTime: "asc" },
            take: 20,
        });

        return res.json({ ok: true, appointments });
    } catch (e) {
        console.error("GET_APPOINTMENTS_ERROR:", e);
        return res.status(500).json({ ok: false, error: "get_appointments_failed" });
    }
});

// ✅ Coach: lista citas
app.get("/coach/appointments", async (req, res) => {
    try {
        const coachId = String(req.query.coachId || "");
        const upcoming = req.query.upcoming === "true";

        if (!coachId) return res.status(400).json({ ok: false, error: "missing_coachId" });

        const appointments = await prisma.appointment.findMany({
            where: {
                coachId,
                ...(upcoming ? { startTime: { gte: new Date() }, status: "BOOKED" } : {}),
            },
            orderBy: { startTime: "asc" },
            take: 50,
            include: {
                client: { select: { clerkUserId: true, meta: true } },
            },
        });

        return res.json({ ok: true, appointments });
    } catch (e) {
        console.error("GET_COACH_APPOINTMENTS_ERROR:", e);
        return res.status(500).json({ ok: false, error: "get_coach_appointments_failed" });
    }
});

// ✅ Actualizar estado de cita
app.patch("/appointments/:id/status", async (req, res) => {
    try {
        const appointmentId = String(req.params.id);
        const { status } = req.body as { status: "BOOKED" | "CANCELLED" | "COMPLETED" };

        if (!["BOOKED", "CANCELLED", "COMPLETED"].includes(status)) {
            return res.status(400).json({ ok: false, error: "invalid_status" });
        }

        const appointment = await prisma.appointment.update({
            where: { id: appointmentId },
            data: { status },
        });

        return res.json({ ok: true, appointment });
    } catch (e) {
        console.error("UPDATE_APPOINTMENT_STATUS_ERROR:", e);
        return res.status(500).json({ ok: false, error: "update_appointment_status_failed" });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// SERVER START
// ══════════════════════════════════════════════════════════════════════════════

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
});     