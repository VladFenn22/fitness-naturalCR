"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DIAS_SEMANA, nombreDia, type RutinaPlan } from "@/lib/rutina";

type EjercicioDraft = {
    name: string;
    sets: string;
    reps: string;
    rir: string;
    restSec: string;
    tempo: string;
    notes: string;
};

type DiaDraft = {
    dayOfWeek: number;
    name: string;
    notes: string;
    exercises: EjercicioDraft[];
};

function nuevoEjercicio(): EjercicioDraft {
    return { name: "", sets: "", reps: "", rir: "", restSec: "", tempo: "", notes: "" };
}

function nuevoDia(dayOfWeek: number): DiaDraft {
    return { dayOfWeek, name: "", notes: "", exercises: [nuevoEjercicio()] };
}

function planToDraft(plan: RutinaPlan): DiaDraft[] {
    return plan.days.map((d) => ({
        dayOfWeek: d.dayOfWeek,
        name: d.name ?? "",
        notes: d.notes ?? "",
        exercises: d.exercises.map((e) => ({
            name: e.name,
            sets: e.sets == null ? "" : String(e.sets),
            reps: e.reps ?? "",
            rir: e.rir ?? "",
            restSec: e.restSec == null ? "" : String(e.restSec),
            tempo: e.tempo ?? "",
            notes: e.notes ?? "",
        })),
    }));
}

const input =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B2A6F]";

export default function RutinaEditor({
    clientUserId,
    planes,
}: {
    clientUserId: string;
    planes: RutinaPlan[];
}) {
    const router = useRouter();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [title, setTitle] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [days, setDays] = useState<DiaDraft[]>([nuevoDia(1)]);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    function resetForm() {
        setEditingId(null);
        setTitle("");
        setStartDate("");
        setEndDate("");
        setDays([nuevoDia(1)]);
    }

    function cargarPlan(plan: RutinaPlan) {
        setEditingId(plan.id);
        setTitle(plan.title);
        setStartDate(plan.startDate ? plan.startDate.slice(0, 10) : "");
        setEndDate(plan.endDate ? plan.endDate.slice(0, 10) : "");
        setDays(plan.days.length ? planToDraft(plan) : [nuevoDia(1)]);
        setMsg(null);
    }

    function updateDay(i: number, patch: Partial<DiaDraft>) {
        setDays((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
    }

    function updateExercise(di: number, ei: number, patch: Partial<EjercicioDraft>) {
        setDays((prev) =>
            prev.map((d, idx) =>
                idx === di
                    ? {
                        ...d,
                        exercises: d.exercises.map((e, j) => (j === ei ? { ...e, ...patch } : e)),
                    }
                    : d
            )
        );
    }

    function buildPayload(activate: boolean) {
        return {
            title: title.trim(),
            startDate: startDate || null,
            endDate: endDate || null,
            activate,
            days: days.map((d, i) => ({
                dayOfWeek: d.dayOfWeek,
                name: d.name.trim() || null,
                notes: d.notes.trim() || null,
                order: i,
                exercises: d.exercises
                    .filter((e) => e.name.trim())
                    .map((e, j) => ({
                        name: e.name.trim(),
                        sets: e.sets ? Number(e.sets) : null,
                        reps: e.reps.trim() || null,
                        rir: e.rir.trim() || null,
                        restSec: e.restSec ? Number(e.restSec) : null,
                        tempo: e.tempo.trim() || null,
                        notes: e.notes.trim() || null,
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
        setBusy(true);
        setMsg(null);
        try {
            const r = await fetch("/api/coach/training-plans", {
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
            setMsg(editingId ? "Rutina actualizada." : "Rutina creada.");
            resetForm();
            router.refresh();
        } catch {
            setMsg("No se pudo guardar la rutina.");
        } finally {
            setBusy(false);
        }
    }

    async function activarPlan(planId: string) {
        setBusy(true);
        setMsg(null);
        try {
            const r = await fetch("/api/coach/training-plans/activate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ planId }),
            });
            const j = await r.json();
            if (!r.ok || !j?.ok) throw new Error("activate_failed");
            setMsg("Rutina activada.");
            router.refresh();
        } catch {
            setMsg("No se pudo activar la rutina.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Rutinas del cliente</h2>
                {planes.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-600">Este cliente no tiene rutinas todavía.</p>
                ) : (
                    <ul className="mt-4 space-y-3">
                        {planes.map((p) => (
                            <li
                                key={p.id}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"
                            >
                                <div>
                                    <div className="text-sm font-semibold text-slate-900">
                                        {p.title}{" "}
                                        {p.isActive ? (
                                            <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                                Activa
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                        {p.days.length} días ·{" "}
                                        {p.days.map((d) => nombreDia(d.dayOfWeek)).join(", ") || "sin días"}
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
                                        href={`/api/rutina/${p.id}/pdf`}
                                        className="rounded-lg bg-[#0B2A6F] px-3 py-2 text-xs font-semibold text-white hover:opacity-95"
                                    >
                                        PDF
                                    </a>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-slate-900">
                        {editingId ? "Editar rutina" : "Nueva rutina"}
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
                            placeholder="Bloque de fuerza · 8 semanas"
                        />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                        Inicio
                        <input
                            type="date"
                            className={`${input} mt-1`}
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                        Fin
                        <input
                            type="date"
                            className={`${input} mt-1`}
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </label>
                </div>

                <div className="mt-6 space-y-5">
                    {days.map((day, di) => (
                        <div key={di} className="rounded-xl border border-slate-200 p-4">
                            <div className="grid gap-3 sm:grid-cols-3">
                                <label className="text-xs font-semibold text-slate-600">
                                    Día
                                    <select
                                        className={`${input} mt-1`}
                                        value={day.dayOfWeek}
                                        onChange={(e) =>
                                            updateDay(di, { dayOfWeek: Number(e.target.value) })
                                        }
                                    >
                                        {DIAS_SEMANA.map((d, i) => (
                                            <option key={d} value={i + 1}>
                                                {d}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="text-xs font-semibold text-slate-600">
                                    Nombre
                                    <input
                                        className={`${input} mt-1`}
                                        value={day.name}
                                        onChange={(e) => updateDay(di, { name: e.target.value })}
                                        placeholder="Empuje"
                                    />
                                </label>
                                <label className="text-xs font-semibold text-slate-600">
                                    Notas
                                    <input
                                        className={`${input} mt-1`}
                                        value={day.notes}
                                        onChange={(e) => updateDay(di, { notes: e.target.value })}
                                    />
                                </label>
                            </div>

                            <div className="mt-4 space-y-3">
                                {day.exercises.map((ex, ei) => (
                                    <div
                                        key={ei}
                                        className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-7"
                                    >
                                        <input
                                            className={`${input} sm:col-span-2`}
                                            value={ex.name}
                                            onChange={(e) => updateExercise(di, ei, { name: e.target.value })}
                                            placeholder="Ejercicio"
                                        />
                                        <input
                                            className={input}
                                            value={ex.sets}
                                            onChange={(e) => updateExercise(di, ei, { sets: e.target.value })}
                                            placeholder="Series"
                                            inputMode="numeric"
                                        />
                                        <input
                                            className={input}
                                            value={ex.reps}
                                            onChange={(e) => updateExercise(di, ei, { reps: e.target.value })}
                                            placeholder="Reps"
                                        />
                                        <input
                                            className={input}
                                            value={ex.rir}
                                            onChange={(e) => updateExercise(di, ei, { rir: e.target.value })}
                                            placeholder="RIR"
                                        />
                                        <input
                                            className={input}
                                            value={ex.restSec}
                                            onChange={(e) =>
                                                updateExercise(di, ei, { restSec: e.target.value })
                                            }
                                            placeholder="Descanso (s)"
                                            inputMode="numeric"
                                        />
                                        <input
                                            className={input}
                                            value={ex.notes}
                                            onChange={(e) => updateExercise(di, ei, { notes: e.target.value })}
                                            placeholder="Notas"
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
                                <button
                                    type="button"
                                    onClick={() =>
                                        updateDay(di, { exercises: [...day.exercises, nuevoEjercicio()] })
                                    }
                                    className="text-[#0B2A6F] hover:underline"
                                >
                                    + Agregar ejercicio
                                </button>
                                {day.exercises.length > 1 ? (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            updateDay(di, { exercises: day.exercises.slice(0, -1) })
                                        }
                                        className="text-slate-500 hover:underline"
                                    >
                                        Quitar último ejercicio
                                    </button>
                                ) : null}
                                {days.length > 1 ? (
                                    <button
                                        type="button"
                                        onClick={() => setDays((prev) => prev.filter((_, i) => i !== di))}
                                        className="text-red-600 hover:underline"
                                    >
                                        Eliminar día
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={() =>
                            setDays((prev) => [...prev, nuevoDia(Math.min(prev.length + 1, 7))])
                        }
                        className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        + Agregar día
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
