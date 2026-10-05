import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

async function redeem(token: string, userId: string) {
	const api = process.env.NEXT_PUBLIC_API_URL!;

	try {
		const r = await fetch(`${api}/invites/redeem`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ token, userId }),
			cache: "no-store",
		});

		const json = (await r.json()) as { ok?: boolean; error?: string };
		if (!r.ok || !json?.ok) {
			console.error("REDEEM_FAILED", { status: r.status, error: json?.error });
			return { ok: false, error: json?.error ?? "redeem_failed" };
		}
		return { ok: true };
	} catch (e) {
		console.error("REDEEM_ERROR", e);
		return { ok: false, error: "network_error" };
	}
}

export default async function OnboardingPage({
	searchParams,
}: {
	searchParams: Promise<{ token?: string }>;
}) {
	const { userId } = await auth();
	if (!userId) redirect("/sign-in");

	const { token } = await searchParams;

	// Sin token no hay nada que canjear: el usuario ya tiene cuenta y solo debe pagar.
	if (!token) redirect("/app/client/billing");

	const result = await redeem(token, userId);

	// El canje fallido se informa en vez de redirigir en silencio.
	if (!result.ok) {
		return (
			<main className="mx-auto max-w-lg px-4 py-20">
				<div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
					<h1 className="text-xl font-semibold text-amber-900">
						No pudimos validar tu invitación
					</h1>
					<p className="mt-2 text-sm text-amber-800">
						El enlace puede haber expirado o ya haber sido utilizado. Escribinos y te
						enviamos uno nuevo.
					</p>
					<div className="mt-5 flex flex-wrap gap-3">
						<Link
							href="/app/client/billing"
							className="inline-flex items-center justify-center rounded-xl bg-[#0B2A6F] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
						>
							Continuar al pago
						</Link>
						<Link
							href="/"
							className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
						>
							Volver al inicio
						</Link>
					</div>
				</div>
			</main>
		);
	}

	redirect("/app/client/billing");
}
