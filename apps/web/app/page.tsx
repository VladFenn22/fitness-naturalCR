import Link from "next/link";
import Navbar from "../components/Navbar";

const features = [
    {
        title: "Rutina estructurada",
        desc: "Tu coach arma el plan por días y ejercicios, con series, repeticiones, descanso y notas.",
    },
    {
        title: "Plan nutricional por plazo",
        desc: "Comidas, alimentos y macros objetivo con una vigencia definida. Al vencer, tu coach te asigna uno nuevo.",
    },
    {
        title: "Acompañamiento con coach",
        desc: "Quedás asignado a un coach que revisa tu contexto y ajusta la rutina cuando toca.",
    },
    {
        title: "Todo en PDF",
        desc: "Descargá tu rutina y tu plan nutricional en PDF imprimible para llevarlos a donde sea.",
    },
];

const pasos = [
    {
        n: "01",
        title: "Aplicá a la asesoría",
        desc: "Completá el formulario con tu objetivo, experiencia y disponibilidad.",
    },
    {
        n: "02",
        title: "Creá tu cuenta y activá el plan",
        desc: "Al ser aprobado, te registrás y contratás tu suscripción mensual.",
    },
    {
        n: "03",
        title: "Recibí tu rutina y tu nutrición",
        desc: "Tu coach activa tu rutina y tu plan nutricional. Los consultás en el panel y los bajás en PDF.",
    },
];

export default function HomePage() {
    return (
        <div className="min-h-screen bg-white text-slate-900">
            <Navbar />

            {/* HERO */}
            <section className="relative overflow-hidden bg-gradient-to-br from-[#0B2A6F] via-[#102a52] to-slate-900">
                <div className="relative mx-auto max-w-6xl px-4 py-20">
                    <div className="max-w-2xl">
                        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/20">
                            Costa Rica · Asesoría fitness online
                            <span className="h-1 w-1 rounded-full bg-white/60" />
                            Cupos limitados
                        </span>

                        <h1 className="mt-5 text-4xl font-bold tracking-tight text-white md:text-5xl">
                            Asesoría fitness con estructura y seguimiento
                        </h1>

                        <p className="mt-4 text-base leading-relaxed text-white/85 md:text-lg">
                            No vendemos “una rutina suelta”. Te asignamos un coach que diseña tu plan de
                            entrenamiento, lo activa en la plataforma y lo ajusta según tu progreso.
                        </p>

                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <Link
                                href="/aplicar"
                                className="inline-flex items-center justify-center rounded-xl bg-[#D61F2C] px-5 py-3 text-sm font-semibold text-white hover:opacity-95"
                            >
                                Aplicar a la asesoría
                            </Link>
                            <Link
                                href="/sign-in"
                                className="inline-flex items-center justify-center rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/30 hover:bg-white/15"
                            >
                                Ya soy cliente
                            </Link>
                        </div>

                        <div className="mt-10 grid grid-cols-3 gap-3 text-white/85">
                            <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/15">
                                <div className="text-lg font-bold text-white">Plan</div>
                                <div className="text-xs">Días y ejercicios</div>
                            </div>
                            <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/15">
                                <div className="text-lg font-bold text-white">Coach</div>
                                <div className="text-xs">Asignado a vos</div>
                            </div>
                            <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/15">
                                <div className="text-lg font-bold text-white">PDF</div>
                                <div className="text-xs">Imprimible</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* SERVICIOS */}
            <section id="servicios" className="mx-auto max-w-6xl px-4 py-16">
                <div className="mb-10">
                    <h2 className="text-3xl font-bold tracking-tight">Qué incluye</h2>
                    <p className="mt-2 max-w-2xl text-slate-600">
                        El servicio se centra en lo que realmente mueve la aguja: un plan claro, un coach
                        que lo mantiene y una rutina que podés llevar al gimnasio.
                    </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {features.map((f) => (
                        <div
                            key={f.title}
                            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                        >
                            <div className="mb-3 h-10 w-10 rounded-xl bg-[#0B2A6F]/10 ring-1 ring-[#0B2A6F]/20" />
                            <h3 className="text-base font-semibold">{f.title}</h3>
                            <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.desc}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-8">
                    <Link
                        href="/servicios"
                        className="text-sm font-semibold text-[#0B2A6F] hover:underline"
                    >
                        Ver paquetes y precios →
                    </Link>
                </div>
            </section>

            {/* CÓMO FUNCIONA */}
            <section id="como-funciona" className="bg-slate-50">
                <div className="mx-auto max-w-6xl px-4 py-16">
                    <h2 className="text-3xl font-bold tracking-tight">Cómo funciona</h2>
                    <p className="mt-2 max-w-2xl text-slate-600">
                        Tres pasos desde que aplicás hasta que tenés tu rutina activa.
                    </p>

                    <div className="mt-8 grid gap-4 md:grid-cols-3">
                        {pasos.map((p) => (
                            <div
                                key={p.n}
                                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                            >
                                <div className="text-sm font-bold text-[#D61F2C]">{p.n}</div>
                                <h3 className="mt-2 text-base font-semibold">{p.title}</h3>
                                <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.desc}</p>
                            </div>
                        ))}
                    </div>

                    <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                        <Link
                            href="/aplicar"
                            className="inline-flex items-center justify-center rounded-xl bg-[#0B2A6F] px-5 py-3 text-sm font-semibold text-white hover:opacity-95"
                        >
                            Ver si aplico
                        </Link>
                        <Link
                            href="/sign-in"
                            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium hover:bg-white"
                        >
                            Ingresar
                        </Link>
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section id="faq" className="mx-auto max-w-6xl px-4 py-16">
                <h2 className="text-3xl font-bold tracking-tight">Preguntas frecuentes</h2>

                <div className="mt-8 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <h3 className="font-semibold">¿Para quién es este servicio?</h3>
                        <p className="mt-2 text-sm text-slate-600">
                            Para cualquier persona que quiera mejorar su físico y salud entrenando con
                            estructura, sin improvisar la rutina semana a semana.
                        </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <h3 className="font-semibold">¿Cómo recibo mi rutina?</h3>
                        <p className="mt-2 text-sm text-slate-600">
                            Tu coach la crea y la activa en la plataforma. Vos la ves en tu panel y podés
                            descargarla en PDF imprimible cuando quieras.
                        </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <h3 className="font-semibold">¿Necesito una suscripción activa?</h3>
                        <p className="mt-2 text-sm text-slate-600">
                            Sí. El acceso a la rutina y a la descarga del PDF requiere tener la
                            suscripción mensual al día.
                        </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <h3 className="font-semibold">¿Puedo cancelar?</h3>
                        <p className="mt-2 text-sm text-slate-600">
                            Sí, la suscripción es mensual y se gestiona desde tu panel en la sección de
                            suscripción y pagos.
                        </p>
                    </div>
                </div>

                <div className="mt-10 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="text-lg font-semibold">¿Listo para empezar?</div>
                        <div className="text-sm text-slate-600">
                            Cupos limitados para asegurar seguimiento real.
                        </div>
                    </div>
                    <Link
                        href="/aplicar"
                        className="inline-flex items-center justify-center rounded-xl bg-[#D61F2C] px-5 py-3 text-sm font-semibold text-white hover:opacity-95"
                    >
                        Aplicar ahora
                    </Link>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="border-t border-slate-200">
                <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-slate-600">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <span className="font-semibold text-slate-900">Fitness Natural CR</span> ·
                            Asesoría y seguimiento
                        </div>
                        <div className="flex gap-4">
                            <Link className="hover:text-slate-900" href="/sign-in">
                                Ingreso
                            </Link>
                            <Link className="hover:text-slate-900" href="/aplicar">
                                Aplicar
                            </Link>
                            <Link className="hover:text-slate-900" href="/servicios">
                                Servicios
                            </Link>
                        </div>
                    </div>
                    <div className="mt-4 text-xs text-slate-500">
                        © {new Date().getFullYear()} · Hecho en Costa Rica
                    </div>
                </div>
            </footer>
        </div>
    );
}
