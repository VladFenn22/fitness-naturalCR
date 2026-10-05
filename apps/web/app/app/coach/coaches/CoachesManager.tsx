"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CoachRow } from "./page";

const input =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0B2A6F]";

export default function CoachesManager({
    coaches,
    puedeEditar,
}: {
    coaches: CoachRow[];
    puedeEditar: boolean;
}) {
    const router = useRouter();
    const [clerkUserId, setClerkUserId] = useState("");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [bio, setBio] = useState("");
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    async function crear() {
        if (!clerkUserId.trim() || !name.trim()) {
            setMsg("Clerk User ID y nombre son obligatorios.");
            return;
        }
        setBusy(true);
        setMsg(null);
        try {
            const r = await fetch("/api/coach/coaches", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "create",
                    clerkUserId: clerkUserId.trim(),
                    name: name.trim(),
                    email: email.trim() || null,
                    bio: bio.trim() || null,
                }),
            });
            const j = await r.json();
            if (!r.ok || !j?.ok) throw new Error("create_failed");
            setClerkUserId("");
            setName("");
            setEmail("");
            setBio("");
            setMsg("Coach guardado.");
            router.refresh();
        } catch {
            setMsg("No se pudo guardar el coach.");
        } finally {
            setBusy(false);
        }
    }

    async function toggleActivo(coach: CoachRow) {
        setBusy(true);
        setMsg(null);
        try {
            const r = await fetch("/api/coach/coaches", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "update",
                    id: coach.id,
                    isActive: !coach.isActive,
                }),
            });
            const j = await r.json();
            if (!r.ok || !j?.ok) throw new Error("update_failed");
            router.refresh();
        } catch {
            setMsg("No se pudo actualizar el coach.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-6">
            {puedeEditar ? (
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900">Nuevo coach</h2>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-semibold text-slate-600">
                            Clerk User ID
                            <input
                                className={`${input} mt-1`}
                                value={clerkUserId}
                                onChange={(e) => setClerkUserId(e.target.value)}
                                placeholder="user_..."
                            />
                        </label>
                        <label className="text-xs font-semibold text-slate-600">
                            Nombre
                            <input
                                className={`${input} mt-1`}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </label>
                        <label className="text-xs font-semibold text-slate-600">
                            Correo
                            <input
                                className={`${input} mt-1`}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </label>
                        <label className="text-xs font-semibold text-slate-600">
                            Bio
                            <input
                                className={`${input} mt-1`}
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                            />
                        </label>
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                        <button
                            type="button"
                            disabled={busy}
                            onClick={crear}
                            className="rounded-xl bg-[#0B2A6F] px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
                        >
                            Guardar coach
                        </button>
                        {msg ? <span className="text-sm text-slate-600">{msg}</span> : null}
                    </div>
                </section>
            ) : null}

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Equipo</h2>
                {coaches.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-600">Todavía no hay coaches registrados.</p>
                ) : (
                    <ul className="mt-4 space-y-3">
                        {coaches.map((c) => (
                            <li
                                key={c.id}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"
                            >
                                <div>
                                    <div className="text-sm font-semibold text-slate-900">
                                        {c.name ?? c.clerkUserId}
                                        {!c.isActive ? (
                                            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                                                Inactivo
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                        {c.email ?? "—"} · {c._count?.clients ?? 0} clientes
                                    </div>
                                </div>
                                {puedeEditar ? (
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => toggleActivo(c)}
                                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                    >
                                        {c.isActive ? "Desactivar" : "Activar"}
                                    </button>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
