import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
	formatFecha,
	formatDescanso,
	nombreDia,
	type RutinaCliente,
	type RutinaPlan,
} from "@/lib/rutina";
import {
	estaVigente,
	etiquetaVigencia,
	formatMacro,
	totalesDelPlan,
	type NutricionPlan,
} from "@/lib/nutricion";

const api = process.env.NEXT_PUBLIC_API_URL!;

async function getSubscription(userId: string) {
	try {
		const r = await fetch(`${api}/me/subscription?userId=${encodeURIComponent(userId)}`, {
			cache: "no-store",
		});
		if (!r.ok) return { active: false, status: "none" };
		return (await r.json()) as { active: boolean; status: string };
	} catch {
		return { active: false, status: "none" };
	}
}

async function getRutina(userId: string) {
	try {
		const r = await fetch(`${api}/me/training-plan/active?userId=${encodeURIComponent(userId)}`, {
			cache: "no-store",
		});
		if (!r.ok) return null;
		return (await r.json()) as { plan: RutinaPlan | null; client: RutinaCliente | null };
	} catch {
		return null;
	}
}

async function getNutricion(userId: string) {
	try {
		const r = await fetch(`${api}/me/nutrition-plan/active?userId=${encodeURIComponent(userId)}`, {
			cache: "no-store",
		});
		if (!r.ok) return null;
		return (await r.json()) as { plan: NutricionPlan | null; vigente: boolean };
	} catch {
		return null;
	}
}

function Card({ children }: { children: React.ReactNode }) {
	return <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">{children}</div>;
}

export default async function ClientDashboard() {
	const { userId } = await auth();
	if (!userId) redirect("/sign-in");

	const sub = await getSubscription(userId);
	// Sin suscripción al día no se expone ni la rutina ni el plan nutricional.
	if (!sub.active) redirect("/app/client/billing");

	const [rutina, nutricion] = await Promise.all([getRutina(userId), getNutricion(userId)]);

	const plan = rutina?.plan ?? null;
	const cliente = rutina?.client ?? null;
	const planNutri = nutricion?.plan ?? null;
	const vigente = planNutri ? estaVigente(planNutri) : false;
	const totales = planNutri ? totalesDelPlan(planNutri) : null;

	return (
		<div className="space-y-6">
			<Card>
				<h1 className="text-2xl font-semibold text-gray-900">
					Hola{cliente?.nombre ? `, ${cliente.nombre}` : ""}
				</h1>
				<p className="mt-1 text-sm text-gray-600">
					{cliente?.coach?.name
						? `Tu coach asignado es ${cliente.coach.name}.`
						: "Todavía no tenés un coach asignado. Te vamos a contactar pronto."}
				</p>
			</Card>

			{/* ───────── Rutina ───────── */}
			<Card>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h2 className="text-lg font-semibold text-gray-900">Mi rutina</h2>
						{plan ? (
							<p className="mt-1 text-sm text-gray-600">
								{plan.title} · {formatFecha(plan.startDate)} — {formatFecha(plan.endDate)}
							</p>
						) : null}
					</div>
					{plan ? (
						<a
							href={`/api/rutina/${plan.id}/pdf`}
							className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
						>
							Descargar PDF
						</a>
					) : null}
				</div>

				{!plan ? (
					<p className="mt-4 text-sm text-gray-600">
						Tu coach está preparando tu rutina. En cuanto la active la vas a ver acá y la vas a poder
						descargar en PDF.
					</p>
				) : (
					<div className="mt-5 space-y-4">
						{plan.days.map((dia) => (
							<div key={dia.id} className="rounded-xl border border-gray-200 p-4">
								<div className="text-sm font-semibold text-gray-900">
									{nombreDia(dia.dayOfWeek)}
									{dia.name ? ` · ${dia.name}` : ""}
								</div>
								{dia.notes ? <p className="mt-1 text-xs text-gray-500">{dia.notes}</p> : null}

								<div className="mt-3 overflow-x-auto">
									<table className="w-full text-left text-sm">
										<thead className="text-xs uppercase text-gray-500">
											<tr>
												<th className="py-2 pr-4">Ejercicio</th>
												<th className="py-2 pr-4">Series</th>
												<th className="py-2 pr-4">Reps</th>
												<th className="py-2 pr-4">RIR</th>
												<th className="py-2 pr-4">Descanso</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-gray-100">
											{dia.exercises.map((ej) => (
												<tr key={ej.id}>
													<td className="py-2 pr-4 text-gray-900">
														{ej.name}
														{ej.notes ? (
															<span className="block text-xs text-gray-500">
																{ej.notes}
															</span>
														) : null}
													</td>
													<td className="py-2 pr-4 text-gray-700">{ej.sets ?? "—"}</td>
													<td className="py-2 pr-4 text-gray-700">{ej.reps ?? "—"}</td>
													<td className="py-2 pr-4 text-gray-700">{ej.rir ?? "—"}</td>
													<td className="py-2 pr-4 text-gray-700">
														{formatDescanso(ej.restSec)}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>
						))}
					</div>
				)}
			</Card>

			{/* ───────── Nutrición ───────── */}
			<Card>
				<div id="nutricion" className="scroll-mt-24" />
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h2 className="text-lg font-semibold text-gray-900">Mi plan nutricional</h2>
						{planNutri ? (
							<p className="mt-1 text-sm text-gray-600">
								{planNutri.title} · {formatFecha(planNutri.startDate)} —{" "}
								{formatFecha(planNutri.endDate)}
							</p>
						) : null}
					</div>
					{planNutri ? (
						<a
							href={`/api/nutricion/${planNutri.id}/pdf`}
							className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
						>
							Descargar PDF
						</a>
					) : null}
				</div>

				{!planNutri ? (
					<p className="mt-4 text-sm text-gray-600">
						Tu coach todavía no te asignó un plan nutricional.
					</p>
				) : (
					<>
						<div
							className={`mt-4 rounded-xl border p-3 text-sm ${
								vigente
									? "border-emerald-200 bg-emerald-50 text-emerald-800"
									: "border-amber-200 bg-amber-50 text-amber-800"
							}`}
						>
							{vigente
								? etiquetaVigencia(planNutri)
								: "El plazo de este plan ya terminó. Seguí las indicaciones hasta que tu coach te asigne uno nuevo."}
						</div>

						<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
							{[
								{ label: "Calorías", objetivo: planNutri.kcal, real: totales?.kcal, suf: " kcal" },
								{ label: "Proteína", objetivo: planNutri.proteinaG, real: totales?.proteina, suf: " g" },
								{ label: "Carbos", objetivo: planNutri.carbsG, real: totales?.carbs, suf: " g" },
								{ label: "Grasas", objetivo: planNutri.grasasG, real: totales?.grasas, suf: " g" },
							].map((m) => (
								<div key={m.label} className="rounded-xl border border-gray-200 p-3">
									<div className="text-xs uppercase text-gray-500">{m.label}</div>
									<div className="mt-1 text-sm font-semibold text-gray-900">
										{formatMacro(m.objetivo, m.suf)}
									</div>
									<div className="text-xs text-gray-500">
										Según alimentos: {formatMacro(m.real ?? null, m.suf)}
									</div>
								</div>
							))}
						</div>

						{planNutri.notes ? (
							<p className="mt-4 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">{planNutri.notes}</p>
						) : null}

						<div className="mt-5 space-y-4">
							{planNutri.meals.map((comida) => (
								<div key={comida.id} className="rounded-xl border border-gray-200 p-4">
									<div className="text-sm font-semibold text-gray-900">
										{comida.name}
										{comida.time ? ` · ${comida.time}` : ""}
									</div>
									{comida.notes ? (
										<p className="mt-1 text-xs text-gray-500">{comida.notes}</p>
									) : null}

									<div className="mt-3 overflow-x-auto">
										<table className="w-full text-left text-sm">
											<thead className="text-xs uppercase text-gray-500">
												<tr>
													<th className="py-2 pr-4">Alimento</th>
													<th className="py-2 pr-4">Cantidad</th>
													<th className="py-2 pr-4">Kcal</th>
													<th className="py-2 pr-4">P</th>
													<th className="py-2 pr-4">C</th>
													<th className="py-2 pr-4">G</th>
												</tr>
											</thead>
											<tbody className="divide-y divide-gray-100">
												{comida.items.map((item) => (
													<tr key={item.id}>
														<td className="py-2 pr-4 text-gray-900">
															{item.name}
															{item.notes ? (
																<span className="block text-xs text-gray-500">
																	{item.notes}
																</span>
															) : null}
														</td>
														<td className="py-2 pr-4 text-gray-700">
															{item.cantidad ?? "—"}
														</td>
														<td className="py-2 pr-4 text-gray-700">
															{formatMacro(item.kcal, "")}
														</td>
														<td className="py-2 pr-4 text-gray-700">
															{formatMacro(item.proteina, "")}
														</td>
														<td className="py-2 pr-4 text-gray-700">
															{formatMacro(item.carbs, "")}
														</td>
														<td className="py-2 pr-4 text-gray-700">
															{formatMacro(item.grasas, "")}
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</div>
							))}
						</div>
					</>
				)}
			</Card>

			<div className="flex flex-wrap gap-3">
				<Link
					href="/app/client/billing"
					className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
				>
					Ver mi suscripción
				</Link>
				<Link
					href="/"
					className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
				>
					Inicio
				</Link>
			</div>
		</div>
	);
}
