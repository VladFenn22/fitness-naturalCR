import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Todas las zonas privadas viven bajo /app (cliente y coach).
// /onboarding también requiere sesión porque canjea la invitación del usuario.
const isProtectedRoute = createRouteMatcher(["/app(.*)", "/onboarding(.*)"]);

export default clerkMiddleware(async (auth, req) => {
    if (isProtectedRoute(req)) await auth.protect();
});

export const config = {
    matcher: [
        // Omite estáticos y archivos con extensión, pero sí corre en rutas de API.
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        "/(api|trpc)(.*)",
    ],
};
