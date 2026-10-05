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
// CU-01 · SOLICITUDES (LEADS) E INVITACIONES
// ══════════════════════════════════════════════════════════════════════════════

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
        console.error("CREATE_LEAD_ERROR:", e);
        return res.status(500).json({ ok: false, error: "Error guardando lead" });
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
    } catch (e) {
        console.error("APPROVE_LEAD_ERROR:", e);
        return res.status(500).json({ ok: false, error: "approve_failed" });
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

        await prisma.$transaction(async (tx) => {
            await tx.lead.update({
                where: { id: lead.id },
                data: { status: "REDEEMED" },
            });

            // CU-04: el visitante aprobado queda dado de alta como cliente
            await tx.clientProfile.upsert({
                where: { clerkUserId: userId },
                update: {
                    nombre: lead.nombre,
                    email: lead.email,
                    meta: lead.objetivo,
                    experiencia: lead.experiencia,
                    disponibilidad: lead.disponibilidad,
                    lesiones: lead.lesiones,
                },
                create: {
                    clerkUserId: userId,
                    nombre: lead.nombre,
                    email: lead.email,
                    meta: lead.objetivo,
                    experiencia: lead.experiencia,
                    disponibilidad: lead.disponibilidad,
                    lesiones: lead.lesiones,
                },
            });
        });

        return res.json({ ok: true, redeemed: true });
    } catch (e) {
        console.error("REDEEM_INVITE_ERROR:", e);
        const message = e instanceof Error ? e.message : typeof e === "string" ? e : "unknown_error";
        return res.status(500).json({ ok: false, error: "redeem_failed", message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// CU-02 · COBRO Y VALIDACIÓN DE SUSCRIPCIÓN
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
// CU-03 · ALTA Y EDICIÓN DE COACHES (ADMIN)
// ══════════════════════════════════════════════════════════════════════════════

app.get("/admin/coaches", async (_req, res) => {
    try {
        const coaches = await prisma.coach.findMany({
            orderBy: { createdAt: "desc" },
            include: { _count: { select: { clients: true } } },
        });

        return res.json({ ok: true, coaches });
    } catch (e) {
        console.error("LIST_COACHES_ERROR:", e);
        return res.status(500).json({ ok: false, error: "list_coaches_failed" });
    }
});

app.post("/admin/coaches", async (req, res) => {
    try {
        const { clerkUserId, name, email, bio } = req.body as {
            clerkUserId?: string;
            name?: string;
            email?: string;
            bio?: string;
        };

        if (!clerkUserId || clerkUserId.trim().length < 3) {
            return res.status(400).json({ ok: false, error: "missing_clerkUserId" });
        }

        const data = {
            name: name?.trim() || null,
            email: email?.trim().toLowerCase() || null,
            bio: bio?.trim() || null,
        };

        const coach = await prisma.coach.upsert({
            where: { clerkUserId: clerkUserId.trim() },
            update: data,
            create: { clerkUserId: clerkUserId.trim(), ...data },
        });

        return res.json({ ok: true, coach });
    } catch (e) {
        console.error("CREATE_COACH_ERROR:", e);
        return res.status(500).json({ ok: false, error: "create_coach_failed" });
    }
});

app.patch("/admin/coaches/:id", async (req, res) => {
    try {
        const id = String(req.params.id);
        const { name, email, bio, isActive } = req.body as {
            name?: string;
            email?: string;
            bio?: string;
            isActive?: boolean;
        };

        const coach = await prisma.coach.update({
            where: { id },
            data: {
                name: name === undefined ? undefined : name.trim() || null,
                email: email === undefined ? undefined : email.trim().toLowerCase() || null,
                bio: bio === undefined ? undefined : bio.trim() || null,
                isActive: isActive === undefined ? undefined : Boolean(isActive),
            },
        });

        return res.json({ ok: true, coach });
    } catch (e) {
        console.error("UPDATE_COACH_ERROR:", e);
        return res.status(500).json({ ok: false, error: "update_coach_failed" });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// CU-04 · CLIENTES Y ASIGNACIÓN A COACH
// ══════════════════════════════════════════════════════════════════════════════

app.get("/me/profile", async (req, res) => {
    try {
        const userId = String(req.query.userId || "");
        if (!userId) return res.status(400).json({ ok: false, error: "missing_userId" });

        const profile = await prisma.clientProfile.findUnique({
            where: { clerkUserId: userId },
            include: { coach: { select: { id: true, name: true, email: true } } },
        });

        return res.json({ ok: true, profile });
    } catch (e) {
        console.error("GET_PROFILE_ERROR:", e);
        return res.status(500).json({ ok: false, error: "get_profile_failed" });
    }
});

app.post("/me/profile", async (req, res) => {
    try {
        const { userId, nombre, email, alturaCm, pesoKg, meta, experiencia, lesiones, disponibilidad } =
            req.body as {
                userId?: string;
                nombre?: string;
                email?: string;
                alturaCm?: number | string;
                pesoKg?: number | string;
                meta?: string;
                experiencia?: string;
                lesiones?: string;
                disponibilidad?: string;
            };

        if (!userId) return res.status(400).json({ ok: false, error: "missing_userId" });

        const altura = alturaCm === "" || alturaCm == null ? null : Number(alturaCm);
        const peso = pesoKg === "" || pesoKg == null ? null : Number(pesoKg);

        const data = {
            nombre: nombre ?? null,
            email: email ? email.trim().toLowerCase() : null,
            alturaCm: Number.isFinite(altura) ? Math.round(altura as number) : null,
            pesoKg: Number.isFinite(peso) ? peso : null,
            meta: meta ?? null,
            experiencia: experiencia ?? null,
            lesiones: lesiones ?? null,
            disponibilidad: disponibilidad ?? null,
        };

        const profile = await prisma.clientProfile.upsert({
            where: { clerkUserId: userId },
            update: data,
            create: { clerkUserId: userId, ...data },
        });

        return res.json({ ok: true, profile });
    } catch (e) {
        console.error("UPSERT_PROFILE_ERROR:", e);
        return res.status(500).json({ ok: false, error: "upsert_profile_failed" });
    }
});

// Coach/Admin: alta manual de cliente
app.post("/admin/clients", async (req, res) => {
    try {
        const { clerkUserId, nombre, email, coachId, meta, experiencia, disponibilidad } = req.body as {
            clerkUserId?: string;
            nombre?: string;
            email?: string;
            coachId?: string;
            meta?: string;
            experiencia?: string;
            disponibilidad?: string;
        };

        if (!clerkUserId || clerkUserId.trim().length < 3) {
            return res.status(400).json({ ok: false, error: "missing_clerkUserId" });
        }

        const data = {
            nombre: nombre?.trim() || null,
            email: email?.trim().toLowerCase() || null,
            coachId: coachId || null,
            meta: meta ?? null,
            experiencia: experiencia ?? null,
            disponibilidad: disponibilidad ?? null,
        };

        const client = await prisma.clientProfile.upsert({
            where: { clerkUserId: clerkUserId.trim() },
            update: data,
            create: { clerkUserId: clerkUserId.trim(), ...data },
        });

        return res.json({ ok: true, client });
    } catch (e) {
        console.error("CREATE_CLIENT_ERROR:", e);
        return res.status(500).json({ ok: false, error: "create_client_failed" });
    }
});

// Coach/Admin: asignar cliente a un coach
app.patch("/admin/clients/:clientUserId/coach", async (req, res) => {
    try {
        const clientUserId = String(req.params.clientUserId);
        const { coachId } = req.body as { coachId?: string | null };

        if (coachId) {
            const coach = await prisma.coach.findUnique({ where: { id: coachId } });
            if (!coach) return res.status(404).json({ ok: false, error: "coach_not_found" });
        }

        const client = await prisma.clientProfile.update({
            where: { clerkUserId: clientUserId },
            data: { coachId: coachId || null },
            include: { coach: { select: { id: true, name: true } } },
        });

        return res.json({ ok: true, client });
    } catch (e) {
        console.error("ASSIGN_COACH_ERROR:", e);
        return res.status(500).json({ ok: false, error: "assign_coach_failed" });
    }
});

// Listado de clientes (todos, o filtrados por coach)
app.get("/coach/clients", async (req, res) => {
    try {
        const coachUserId = String(req.query.coachUserId || "");

        let coachId: string | undefined;
        if (coachUserId) {
            const coach = await prisma.coach.findUnique({
                where: { clerkUserId: coachUserId },
                select: { id: true },
            });
            if (!coach) return res.json({ ok: true, clients: [] });
            coachId = coach.id;
        }

        const clients = await prisma.clientProfile.findMany({
            where: coachId ? { coachId } : {},
            orderBy: { createdAt: "desc" },
            take: 200,
            include: {
                coach: { select: { id: true, name: true } },
                trainingPlans: {
                    where: { isActive: true },
                    select: { id: true, title: true, updatedAt: true },
                    take: 1,
                },
            },
        });

        return res.json({ ok: true, clients });
    } catch (e) {
        console.error("LIST_CLIENTS_ERROR:", e);
        return res.status(500).json({ ok: false, error: "list_clients_failed" });
    }
});

// Detalle de un cliente con sus planes
app.get("/coach/clients/:clientUserId", async (req, res) => {
    try {
        const clientUserId = String(req.params.clientUserId);

        const client = await prisma.clientProfile.findUnique({
            where: { clerkUserId: clientUserId },
            include: {
                coach: { select: { id: true, name: true, email: true } },
                trainingPlans: {
                    orderBy: { createdAt: "desc" },
                    include: {
                        days: {
                            orderBy: [{ order: "asc" }, { dayOfWeek: "asc" }],
                            include: { exercises: { orderBy: { order: "asc" } } },
                        },
                    },
                },
                nutritionPlans: {
                    orderBy: { createdAt: "desc" },
                    include: {
                        meals: {
                            orderBy: { order: "asc" },
                            include: { items: { orderBy: { order: "asc" } } },
                        },
                    },
                },
            },
        });

        if (!client) return res.status(404).json({ ok: false, error: "client_not_found" });

        return res.json({ ok: true, client });
    } catch (e) {
        console.error("GET_CLIENT_ERROR:", e);
        return res.status(500).json({ ok: false, error: "get_client_failed" });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// CU-05 / CU-06 / CU-08 · RUTINAS (PLAN → DÍAS → EJERCICIOS)
// ══════════════════════════════════════════════════════════════════════════════

type PlanDayInput = {
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
};

function mapDaysToCreate(days: PlanDayInput[]) {
    return days.map((d, i) => ({
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
    }));
}

const planInclude = {
    days: {
        orderBy: [{ order: "asc" as const }, { dayOfWeek: "asc" as const }],
        include: { exercises: { orderBy: { order: "asc" as const } } },
    },
};

// CU-08: el cliente consulta su rutina activa
app.get("/me/training-plan/active", async (req, res) => {
    try {
        const userId = String(req.query.userId || "");
        if (!userId) return res.status(400).json({ ok: false, error: "missing_userId" });

        const client = await prisma.clientProfile.findUnique({
            where: { clerkUserId: userId },
            select: { id: true, nombre: true, email: true, coach: { select: { name: true } } },
        });

        if (!client) return res.status(404).json({ ok: false, error: "profile_not_found" });

        const plan = await prisma.trainingPlan.findFirst({
            where: { clientId: client.id, isActive: true },
            orderBy: { createdAt: "desc" },
            include: planInclude,
        });

        return res.json({ ok: true, plan, client });
    } catch (e) {
        console.error("GET_ACTIVE_TRAINING_PLAN_ERROR:", e);
        return res.status(500).json({ ok: false, error: "get_active_training_plan_failed" });
    }
});

// CU-05: el coach crea una rutina
app.post("/coach/clients/:clientUserId/training-plans", async (req, res) => {
    try {
        const clientUserId = String(req.params.clientUserId || "");
        if (!clientUserId) return res.status(400).json({ ok: false, error: "missing_clientUserId" });

        const { title, startDate, endDate, days, activate } = req.body as {
            title?: string;
            startDate?: string | null;
            endDate?: string | null;
            days?: PlanDayInput[];
            activate?: boolean;
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

        const isActive = activate !== false;

        const created = await prisma.$transaction(async (tx) => {
            if (isActive) {
                await tx.trainingPlan.updateMany({
                    where: { clientId: client.id, isActive: true },
                    data: { isActive: false },
                });
            }

            return tx.trainingPlan.create({
                data: {
                    clientId: client.id,
                    title: title.trim(),
                    isActive,
                    startDate: startDate ? new Date(startDate) : null,
                    endDate: endDate ? new Date(endDate) : null,
                    days: { create: mapDaysToCreate(days) },
                },
                include: planInclude,
            });
        });

        return res.json({ ok: true, plan: created });
    } catch (e) {
        console.error("CREATE_TRAINING_PLAN_ERROR:", e);
        return res.status(500).json({ ok: false, error: "create_training_plan_failed" });
    }
});

// CU-05: el coach edita una rutina existente (reemplaza días y ejercicios)
app.put("/coach/training-plans/:planId", async (req, res) => {
    try {
        const planId = String(req.params.planId);
        const { title, startDate, endDate, days } = req.body as {
            title?: string;
            startDate?: string | null;
            endDate?: string | null;
            days?: PlanDayInput[];
        };

        if (!title || typeof title !== "string" || title.trim().length < 2) {
            return res.status(400).json({ ok: false, error: "invalid_title" });
        }
        if (!Array.isArray(days) || days.length === 0) {
            return res.status(400).json({ ok: false, error: "missing_days" });
        }

        const existing = await prisma.trainingPlan.findUnique({ where: { id: planId } });
        if (!existing) return res.status(404).json({ ok: false, error: "plan_not_found" });

        const updated = await prisma.$transaction(async (tx) => {
            await tx.trainingDay.deleteMany({ where: { planId } });

            return tx.trainingPlan.update({
                where: { id: planId },
                data: {
                    title: title.trim(),
                    startDate: startDate ? new Date(startDate) : null,
                    endDate: endDate ? new Date(endDate) : null,
                    days: { create: mapDaysToCreate(days) },
                },
                include: planInclude,
            });
        });

        return res.json({ ok: true, plan: updated });
    } catch (e) {
        console.error("UPDATE_TRAINING_PLAN_ERROR:", e);
        return res.status(500).json({ ok: false, error: "update_training_plan_failed" });
    }
});

// CU-06: activar una rutina (desactiva las demás del cliente)
app.patch("/coach/training-plans/:planId/activate", async (req, res) => {
    try {
        const planId = String(req.params.planId);

        const plan = await prisma.trainingPlan.findUnique({
            where: { id: planId },
            select: { id: true, clientId: true },
        });

        if (!plan) return res.status(404).json({ ok: false, error: "plan_not_found" });

        const activated = await prisma.$transaction(async (tx) => {
            await tx.trainingPlan.updateMany({
                where: { clientId: plan.clientId, isActive: true },
                data: { isActive: false },
            });

            return tx.trainingPlan.update({
                where: { id: planId },
                data: { isActive: true },
                include: planInclude,
            });
        });

        return res.json({ ok: true, plan: activated });
    } catch (e) {
        console.error("ACTIVATE_TRAINING_PLAN_ERROR:", e);
        return res.status(500).json({ ok: false, error: "activate_training_plan_failed" });
    }
});

// CU-07: datos completos de la rutina para generar el PDF
app.get("/training-plans/:planId", async (req, res) => {
    try {
        const planId = String(req.params.planId);

        const plan = await prisma.trainingPlan.findUnique({
            where: { id: planId },
            include: {
                days: {
                    orderBy: [{ order: "asc" }, { dayOfWeek: "asc" }],
                    include: { exercises: { orderBy: { order: "asc" } } },
                },
                client: {
                    select: {
                        clerkUserId: true,
                        nombre: true,
                        email: true,
                        coach: { select: { name: true } },
                    },
                },
            },
        });

        if (!plan) return res.status(404).json({ ok: false, error: "plan_not_found" });

        return res.json({ ok: true, plan });
    } catch (e) {
        console.error("GET_TRAINING_PLAN_ERROR:", e);
        return res.status(500).json({ ok: false, error: "get_training_plan_failed" });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// CU-09 · PLAN NUTRICIONAL (PLAN → COMIDAS → ALIMENTOS, CON PLAZO DETERMINADO)
// ══════════════════════════════════════════════════════════════════════════════

type MealInput = {
    name: string;
    time?: string | null;
    notes?: string | null;
    order?: number;
    items?: Array<{
        name: string;
        cantidad?: string | null;
        kcal?: number | null;
        proteina?: number | null;
        carbs?: number | null;
        grasas?: number | null;
        notes?: string | null;
        order?: number;
    }>;
};

function mapMealsToCreate(meals: MealInput[]) {
    return meals.map((m, i) => ({
        name: String(m.name).trim(),
        time: m.time ?? null,
        notes: m.notes ?? null,
        order: Number.isFinite(m.order as number) ? Number(m.order) : i,
        items: {
            create: (m.items ?? []).map((it, j) => ({
                name: String(it.name).trim(),
                cantidad: it.cantidad ?? null,
                kcal: it.kcal == null ? null : Number(it.kcal),
                proteina: it.proteina == null ? null : Number(it.proteina),
                carbs: it.carbs == null ? null : Number(it.carbs),
                grasas: it.grasas == null ? null : Number(it.grasas),
                notes: it.notes ?? null,
                order: Number.isFinite(it.order as number) ? Number(it.order) : j,
            })),
        },
    }));
}

const nutritionInclude = {
    meals: {
        orderBy: { order: "asc" as const },
        include: { items: { orderBy: { order: "asc" as const } } },
    },
};

type NutritionBody = {
    title?: string;
    startDate?: string | null;
    endDate?: string | null;
    kcal?: number | null;
    proteinaG?: number | null;
    carbsG?: number | null;
    grasasG?: number | null;
    notes?: string | null;
    meals?: MealInput[];
    activate?: boolean;
};

// Valida el cuerpo común de creación y edición. Devuelve el error o los datos listos.
function parseNutritionBody(body: NutritionBody) {
    const { title, startDate, endDate, meals } = body;

    if (!title || typeof title !== "string" || title.trim().length < 2) {
        return { error: "invalid_title" as const };
    }
    if (!startDate || !endDate) {
        return { error: "missing_date_range" as const };
    }

    const inicio = new Date(startDate);
    const fin = new Date(endDate);

    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
        return { error: "invalid_date_range" as const };
    }
    if (fin <= inicio) {
        return { error: "end_date_before_start" as const };
    }
    if (!Array.isArray(meals) || meals.length === 0) {
        return { error: "missing_meals" as const };
    }

    return {
        data: {
            title: title.trim(),
            startDate: inicio,
            endDate: fin,
            kcal: body.kcal == null ? null : Number(body.kcal),
            proteinaG: body.proteinaG == null ? null : Number(body.proteinaG),
            carbsG: body.carbsG == null ? null : Number(body.carbsG),
            grasasG: body.grasasG == null ? null : Number(body.grasasG),
            notes: body.notes ?? null,
        },
        meals,
    };
}

// CU-09: el cliente consulta su plan nutricional vigente
app.get("/me/nutrition-plan/active", async (req, res) => {
    try {
        const userId = String(req.query.userId || "");
        if (!userId) return res.status(400).json({ ok: false, error: "missing_userId" });

        const client = await prisma.clientProfile.findUnique({
            where: { clerkUserId: userId },
            select: { id: true, nombre: true, email: true, coach: { select: { name: true } } },
        });

        if (!client) return res.status(404).json({ ok: false, error: "profile_not_found" });

        const plan = await prisma.nutritionPlan.findFirst({
            where: { clientId: client.id, isActive: true },
            orderBy: { createdAt: "desc" },
            include: nutritionInclude,
        });

        // El plazo determina si el plan sigue vigente o ya venció
        const vigente = plan ? new Date() <= plan.endDate : false;

        return res.json({ ok: true, plan, vigente, client });
    } catch (e) {
        console.error("GET_ACTIVE_NUTRITION_PLAN_ERROR:", e);
        return res.status(500).json({ ok: false, error: "get_active_nutrition_plan_failed" });
    }
});

// CU-09: el coach crea un plan nutricional para un plazo determinado
app.post("/coach/clients/:clientUserId/nutrition-plans", async (req, res) => {
    try {
        const clientUserId = String(req.params.clientUserId || "");
        if (!clientUserId) return res.status(400).json({ ok: false, error: "missing_clientUserId" });

        const parsed = parseNutritionBody(req.body as NutritionBody);
        if ("error" in parsed) return res.status(400).json({ ok: false, error: parsed.error });

        const client = await prisma.clientProfile.findUnique({
            where: { clerkUserId: clientUserId },
            select: { id: true },
        });

        if (!client) return res.status(404).json({ ok: false, error: "profile_not_found" });

        const isActive = (req.body as NutritionBody).activate !== false;

        const created = await prisma.$transaction(async (tx) => {
            if (isActive) {
                await tx.nutritionPlan.updateMany({
                    where: { clientId: client.id, isActive: true },
                    data: { isActive: false },
                });
            }

            return tx.nutritionPlan.create({
                data: {
                    clientId: client.id,
                    isActive,
                    ...parsed.data,
                    meals: { create: mapMealsToCreate(parsed.meals) },
                },
                include: nutritionInclude,
            });
        });

        return res.json({ ok: true, plan: created });
    } catch (e) {
        console.error("CREATE_NUTRITION_PLAN_ERROR:", e);
        return res.status(500).json({ ok: false, error: "create_nutrition_plan_failed" });
    }
});

// CU-09: el coach edita un plan nutricional (reemplaza comidas y alimentos)
app.put("/coach/nutrition-plans/:planId", async (req, res) => {
    try {
        const planId = String(req.params.planId);

        const parsed = parseNutritionBody(req.body as NutritionBody);
        if ("error" in parsed) return res.status(400).json({ ok: false, error: parsed.error });

        const existing = await prisma.nutritionPlan.findUnique({ where: { id: planId } });
        if (!existing) return res.status(404).json({ ok: false, error: "plan_not_found" });

        const updated = await prisma.$transaction(async (tx) => {
            await tx.nutritionMeal.deleteMany({ where: { planId } });

            return tx.nutritionPlan.update({
                where: { id: planId },
                data: {
                    ...parsed.data,
                    meals: { create: mapMealsToCreate(parsed.meals) },
                },
                include: nutritionInclude,
            });
        });

        return res.json({ ok: true, plan: updated });
    } catch (e) {
        console.error("UPDATE_NUTRITION_PLAN_ERROR:", e);
        return res.status(500).json({ ok: false, error: "update_nutrition_plan_failed" });
    }
});

// CU-09: activar un plan nutricional (desactiva los demás del cliente)
app.patch("/coach/nutrition-plans/:planId/activate", async (req, res) => {
    try {
        const planId = String(req.params.planId);

        const plan = await prisma.nutritionPlan.findUnique({
            where: { id: planId },
            select: { id: true, clientId: true },
        });

        if (!plan) return res.status(404).json({ ok: false, error: "plan_not_found" });

        const activated = await prisma.$transaction(async (tx) => {
            await tx.nutritionPlan.updateMany({
                where: { clientId: plan.clientId, isActive: true },
                data: { isActive: false },
            });

            return tx.nutritionPlan.update({
                where: { id: planId },
                data: { isActive: true },
                include: nutritionInclude,
            });
        });

        return res.json({ ok: true, plan: activated });
    } catch (e) {
        console.error("ACTIVATE_NUTRITION_PLAN_ERROR:", e);
        return res.status(500).json({ ok: false, error: "activate_nutrition_plan_failed" });
    }
});

// CU-09: datos completos del plan nutricional para generar el PDF
app.get("/nutrition-plans/:planId", async (req, res) => {
    try {
        const planId = String(req.params.planId);

        const plan = await prisma.nutritionPlan.findUnique({
            where: { id: planId },
            include: {
                meals: {
                    orderBy: { order: "asc" },
                    include: { items: { orderBy: { order: "asc" } } },
                },
                client: {
                    select: {
                        clerkUserId: true,
                        nombre: true,
                        email: true,
                        coach: { select: { name: true } },
                    },
                },
            },
        });

        if (!plan) return res.status(404).json({ ok: false, error: "plan_not_found" });

        return res.json({ ok: true, plan });
    } catch (e) {
        console.error("GET_NUTRITION_PLAN_ERROR:", e);
        return res.status(500).json({ ok: false, error: "get_nutrition_plan_failed" });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// SERVER START
// ══════════════════════════════════════════════════════════════════════════════

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
});
