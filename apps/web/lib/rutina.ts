export type RutinaEjercicio = {
    id: string;
    name: string;
    sets: number | null;
    reps: string | null;
    rir: string | null;
    restSec: number | null;
    tempo: string | null;
    notes: string | null;
};

export type RutinaDia = {
    id: string;
    dayOfWeek: number;
    name: string | null;
    notes: string | null;
    exercises: RutinaEjercicio[];
};

export type RutinaPlan = {
    id: string;
    title: string;
    isActive: boolean;
    startDate: string | null;
    endDate: string | null;
    days: RutinaDia[];
};

export type RutinaCliente = {
    nombre: string | null;
    email: string | null;
    coach?: { name: string | null } | null;
};

export const DIAS_SEMANA = [
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
    "Domingo",
];

export function nombreDia(dayOfWeek: number) {
    return DIAS_SEMANA[dayOfWeek - 1] ?? `Día ${dayOfWeek}`;
}

export function formatFecha(value: string | null) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("es-CR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDescanso(restSec: number | null) {
    if (restSec == null) return "—";
    if (restSec < 60) return `${restSec}s`;
    const min = Math.floor(restSec / 60);
    const sec = restSec % 60;
    return sec === 0 ? `${min}min` : `${min}min ${sec}s`;
}
