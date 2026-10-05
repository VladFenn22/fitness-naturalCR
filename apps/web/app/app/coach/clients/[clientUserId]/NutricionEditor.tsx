"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { etiquetaVigencia, estaVigente, type NutricionPlan } from "@/lib/nutricion";
import { formatFecha } from "@/lib/rutina";

type ItemDraft = {
    name: string;
    cantidad: string;
    kcal: string;
    proteina: string;
    carbs: string;
    grasas: string;
    notes: string;
};

type ComidaDraft = {
    name: string;
    time: string;
    notes: string;
    items: ItemDraft[];
};

function nuevoItem(): ItemDraft {
    return { name: "", cantidad: "", kcal: "", proteina: "", carbs: "", grasas: "", notes: "" };
}

function nuevaComida(name = ""): ComidaDraft {
    return { name, time: "", notes: "", items: [nuevoItem()] };
}

const COMIDAS_BASE = ["Desayuno", "Merienda AM", "Almuerzo", "Merienda PM", "Cena"];

function planToDraft(plan: NutricionPlan): ComidaDraft[] {
    return plan.meals.map((m) => ({
        name: m.name,
        time: m.time ?? "",
        notes: m.notes ?? "",
        items: m.items.map((it) => ({
            name: it.name,
            cantidad: it.cantidad ?? "",
            kcal: it.kcal == null ? "" : String(it.kcal),
            proteina: it.proteina == null ? "" : String(it.proteina),
            carbs: it.carbs == null ? "" : String(it.carbs),
            grasas: it.grasas == null ? "" : String(it.grasas),
            notes: it.notes ?? "",
        })),
    }));
}

const input =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B2A6F]";

function num(v: string) {
    return v.trim() === "" ? null : Number(v);
}

export default function NutricionEditor({
    clientUserId,
    planes,
}: {
    clientUserId: string;
    planes: NutricionPlan[];
}) {
    const router = useRouter();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [title, setTitle] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [kcal, setKcal] = useState("");
    const [proteinaG, setProteinaG] = useState("");
    const [carbsG, setCarbsG] = useState("");
    const [grasasG, setGrasasG] = useState("");
    const [notes, setNotes] = useState("");
    const [meals, setMeals] = useState<ComidaDraft[]>(COMIDAS_BASE.map((n) => nuevaComida(n)));
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    function resetForm() {
        setEditingId(null);
        setTitle("");
        setStartDate("");
        setEndDate("");
        setKcal("");
        setProteinaG("");
        setCarbsG("");
        setGrasasG("");
        setNotes("");
        setMeals(COMIDAS_BASE.map((n) => nuevaComida(n)));
    }

    function cargarPlan(plan: NutricionPlan) {
        setEditingId(plan.id);
        setTitle(plan.title);
        setStartDate(plan.startDate.slice(0, 10));
        setEndDate(plan.endDate.slice(0, 10));
        setKcal(plan.kcal == null ? "" : String(plan.kcal));
        setProteinaG(plan.proteinaG == null ? "" : String(plan.proteinaG));
        setCarbsG(plan.carbsG == null ? "" : String(plan.carbsG));
        setGrasasG(plan.grasasG == null ? "" : String(plan.grasasG));
        setNotes(plan.notes ?? "");
        setMeals(plan.meals.length ? planToDraft(plan) : [nuevaComida()]);
        setMsg(null);
    }

    /** Prepara un plan nuevo reusando la estructura del anterior al vencer el plazo. */
    function renovarPlan(plan: NutricionPlan) {
        cargarPlan(plan);
        setEditingId(null);
        setTitle(`${plan.title} (renovación)`);
        const desde = new Date(plan.endDate);
        desde.setDate(desde.getDate() + 1);
        const hasta = new Date(desde);
        hasta.setDate(hasta.getDate() + 28);
        setStartDate(desde.toISOString().slice(0, 10));
        setEndDate(hasta.toISOString().slice(0, 10));
        setMsg("Revisá el nuevo plazo y guardá para reemplazar el plan vencido.");
    }

    function updateMeal(i: number, patch: Partial<ComidaDraft>) {
        setMeals((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
    }

    function updateItem(mi: number, ii: number, patch: Partial<ItemDraft>) {
        setMeals((prev) =>
            prev.map((m, idx) =>
                idx === mi
                    ? { ...m, items: m.items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) }
                    : m
            )
        );
    }

    function buildPayload(activate: boolean) {
        return {
            title: title.trim(),
            startDate,
            endDate,
            kcal: num(kcal),
            proteinaG: num(proteinaG),
            carbsG: num(carbsG),
            grasasG: num(grasasG),
            notes: notes.trim() || null,
            activate,
            meals: meals
                .filter((m) => m.name.trim())
                .map((m, i) => ({
                    name: m.name.trim(),
                    time: m.time.trim() || null,
                    notes: m.notes.trim() || null,
                    order: i,
                    items: m.items
                        .filter((it) => it.name.trim())
                        .map((it, j) => ({
                            name: it.name.trim(),
                            cantidad: it.cantidad.trim() || null,
                            kcal: num(it.kcal),
                            proteina: num(it.proteina),
                            carbs: num(it.carbs),
                            grasas: num(it.grasas),
                            notes: it.notes.trim() || null,
                            order: j,
                        })),
                })),
        };
    }

    async function guardar(activate: boolean) {
        if (!title.trim()) {
            setMsg("Poné un título al plan.");
            return;
        }
        if (!startDate || !endDate) {
            setMsg("El plan nutricional requiere fecha de inicio y de fin.");
            return;
        }
        if (new Date(endDate) <= new Date(startDate)) {
            setMsg("La fecha de fin debe ser posterior a la de inicio.");
            return;
        }

        setBusy(true);
        setMsg(null);
        try {
            const r = await fetch("/api/coach/nutrition-plans", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientUserId,
                    planId: editingId,
                    plan: buildPayload(activate),
                }),
            });
            const j = await r.json();
            if (!r.ok || !j?.ok) throw new Error(j?.error ?? "save_failed");
            setMsg(editingId ? "Plan nutricional actualizado." : "Plan nutricional creado.");
            resetForm();
            router.refresh();
        } catch {
            setMsg("No se pudo guardar el plan nutricional.");
        } finally {
            setBusy(false);
        }
    }

    async function activarPlan(planId: string) {
        setBusy(true);
        setMsg(null);
        try {
            const r = await fetch("/api/coach/nutrition-plans/activate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ planId }),
            });
            const j = await r.json();
            if (!r.ok || !j?.ok) throw new Error("activate_failed");
            setMsg("Plan nutricional activado.");
            router.refresh();
        } catch {
            setMsg("No se pudo activar el plan.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Planes nutricionales</h2>
                {planes.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-600">
                        Este cliente no tiene planes nutricionales todavía.
                    </p>
                ) : (
                    <ul className="mt-4 space-y-3">
                        {planes.map((p) => {
                            const vigente = estaVigente(p);
                            return (
                                <li
                                    key={p.id}
                                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"
                                >
                                    <div>
                                        <div className="text-sm font-semibold text-slate-900">
                                            {p.title}
                                            {p.isActive ? (
                                                <span
                                                    className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${vigente
                                                        ? "bg-emerald-50 text-emerald-700"
                                                        : "bg-amber-50 text-amber-700"
                                                        }`}
                                                >
                                                    {vigente ? "Vigente" : "Vencido"}
                                                </span>
                                            ) : null}
                                        </div>
                                        <div className="mt-1 text-xs text-slate-500">
                                            {formatFecha(p.startDate)} — {formatFecha(p.endDate)} ·{" "}
                                            {etiquetaVigencia(p)} · {p.meals.length} comidas
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => cargarPlan(p)}
                                            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                        >
                                            Editar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => renovarPlan(p)}
                                            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                        >
                                            Renovar plazo
                                        </button>
                                        {!p.isActive ? (
                                            <button
                                                type="button"
                                                disabled={busy}
                                                onClick={() => activarPlan(p.id)}
                                                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:opacity-95 disabled:opacity-50"
                                            >
                                                Activar
                                            </button>
                                        ) : null}
                                        <a
                                            href={`/api/nutricion/${p.id}/pdf`}
                                            className="rounded-lg bg-[#0B2A6F] px-3 py-2 text-xs font-semibold text-white hover:opacity-95"
                                        >
                                            PDF
                                        </a>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-slate-900">
                        {editingId ? "Editar plan nutricional" : "Nuevo plan nutricional"}
                    </h2>
                    {editingId ? (
                        <button
                            type="button"
                            onClick={resetForm}
                            className="text-xs font-semibold text-slate-500 hover:underline"
                        >
                            Cancelar edición
                        </button>
                    ) : null}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <label className="text-xs font-semibold text-slate-600">
                        Título
                        <input
                            className={`${input} mt-1`}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Déficit moderado · 4 semanas"
                        />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                        Inicio del plazo
                        <input
                            type="date"
                            className={`${input} mt-1`}
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                        Fin del plazo
                        <input
                            type="date"
                            className={`${input} mt-1`}
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </label>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                    <label className="text-xs font-semibold text-slate-600">
                        Kcal objetivo
                        <input
                            className={`${input} mt-1`}
                            value={kcal}
                            onChange={(e) => setKcal(e.target.value)}
                            inputMode="numeric"
                        />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                        Proteína (g)
                        <input
                            className={`${input} mt-1`}
                            value={proteinaG}
                            onChange={(e) => setProteinaG(e.target.value)}
                            inputMode="numeric"
                        />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                        Carbohidratos (g)
                        <input
                            className={`${input} mt-1`}
                            value={carbsG}
                            onChange={(e) => setCarbsG(e.target.value)}
                            inputMode="numeric"
                        />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                        Grasas (g)
                        <input
                            className={`${input} mt-1`}
                            value={grasasG}
                            onChange={(e) => setGrasasG(e.target.value)}
                            inputMode="numeric"
                        />
                    </label>
                </div>

                <label className="mt-3 block text-xs font-semibold text-slate-600">
                    Indicaciones generales
                    <input
                        className={`${input} mt-1`}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Hidratación, suplementación, libre semanal..."
                    />
                </label>

                <div className="mt-6 space-y-5">
                    {meals.map((meal, mi) => (
                        <div key={mi} className="rounded-xl border border-slate-200 p-4">
                            <div className="grid gap-3 sm:grid-cols-3">
                                <label className="text-xs font-semibold text-slate-600">
                                    Comida
                                    <input
                                        className={`${input} mt-1`}
                                        value={meal.name}
                                        onChange={(e) => updateMeal(mi, { name: e.target.value })}
                                        placeholder="Desayuno"
                                    />
                                </label>
                                <label className="text-xs font-semibold text-slate-600">
                                    Hora
                                    <input
                                        className={`${input} mt-1`}
                                        value={meal.time}
                                        onChange={(e) => updateMeal(mi, { time: e.target.value })}
                                        placeholder="07:00"
                                    />
                                </label>
                                <label className="text-xs font-semibold text-slate-600">
                                    Notas
                                    <input
                                        className={`${input} mt-1`}
                                        value={meal.notes}
                                        onChange={(e) => updateMeal(mi, { notes: e.target.value })}
                                    />
                                </label>
                            </div>

                            <div className="mt-4 space-y-2">
                                {meal.items.map((it, ii) => (
                                    <div
                                        key={ii}
                                        className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-7"
                                    >
                                        <input
                                            className={`${input} sm:col-span-2`}
                                            value={it.name}
                                            onChange={(e) => updateItem(mi, ii, { name: e.target.value })}
                                            placeholder="Alimento"
                                        />
                                        <input
                                            className={input}
                                            value={it.cantidad}
                                            onChange={(e) =>
                                                updateItem(mi, ii, { cantidad: e.target.value })
                                            }
                                            placeholder="Cantidad"
                                        />
                                        <input
                                            className={input}
                                            value={it.kcal}
                                            onChange={(e) => updateItem(mi, ii, { kcal: e.target.value })}
                                            placeholder="Kcal"
                                            inputMode="numeric"
                                        />
                                        <input
                                            className={input}
                                            value={it.proteina}
                                            onChange={(e) =>
                                                updateItem(mi, ii, { proteina: e.target.value })
                                            }
                                            placeholder="Prot."
                                            inputMode="decimal"
                                        />
                                        <input
                                            className={input}
                                            value={it.carbs}
                                            onChange={(e) => updateItem(mi, ii, { carbs: e.target.value })}
                                            placeholder="Carbs"
                                            inputMode="decimal"
                                        />
                                        <input
                                            className={input}
                                            value={it.grasas}
                                            onChange={(e) => updateItem(mi, ii, { grasas: e.target.value })}
                                            placeholder="Grasas"
                                            inputMode="decimal"
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
                                <button
                                    type="button"
                                    onClick={() => updateMeal(mi, { items: [...meal.items, nuevoItem()] })}
                                    className="text-[#0B2A6F] hover:underline"
                                >
                                    + Agregar alimento
                                </button>
                                {meal.items.length > 1 ? (
                                    <button
                                        type="button"
                                        onClick={() => updateMeal(mi, { items: meal.items.slice(0, -1) })}
                                        className="text-slate-500 hover:underline"
                                    >
                                        Quitar último alimento
                                    </button>
                                ) : null}
                                {meals.length > 1 ? (
                                    <button
                                        type="button"
                                        onClick={() => setMeals((prev) => prev.filter((_, i) => i !== mi))}
                                        className="text-red-600 hover:underline"
                                    >
                                        Eliminar comida
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setMeals((prev) => [...prev, nuevaComida()])}
                        className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        + Agregar comida
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => guardar(false)}
                        className="rounded-xl border border-[#0B2A6F] px-4 py-2 text-sm font-semibold text-[#0B2A6F] hover:bg-slate-50 disabled:opacity-50"
                    >
                        Guardar
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => guardar(true)}
                        className="rounded-xl bg-[#0B2A6F] px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
                    >
                        Guardar y activar
                    </button>
                    {msg ? <span className="text-sm text-slate-600">{msg}</span> : null}
                </div>
            </section>
        </div>
    );
}
