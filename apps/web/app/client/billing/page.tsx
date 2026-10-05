import { redirect } from "next/navigation";

/** La zona privada se unificó bajo /app. Se conserva la URL anterior para no romper enlaces. */
export default function LegacyBillingRedirect() {
	redirect("/app/client/billing");
}
