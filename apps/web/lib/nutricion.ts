export type NutricionItem = {
    id: string;
    name: string;
    cantidad: string | null;
    kcal: number | null;
    proteina: number | null;
    carbs: number | null;
    grasas: number | null;
    notes: string | null;
};

export type NutricionComida = {
    id: string;
    name: string;
    time: string | null;
    notes: string | null;
    items: NutricionItem[];
};

export type NutricionPlan = {
    id: string;
    title: string;
    isActive: boolean;
    startDate: string;
    endDate: string;
    kcal: number | null;
    proteinaG: number | null;
    carbsG: number | null;
    grasasG: number | null;
    notes: string | null;
    meals: NutricionComida[];
};

/** Un plan rige solo dentro de su plazo; al vencer debe reemplazarse por uno nuevo. */
export function estaVigente(plan: Pick<NutricionPlan, "endDate">, ahora = new Date()) {
    const fin = new Date(plan.endDate);
    if (Number.isNaN(fin.getTime())) return false;
    return ahora <= fin;
}

/** Días restantes del plazo. Negativo si ya venció. */
export function diasRestantes(plan: Pick<NutricionPlan, "endDate">, ahora = new Date()) {
    const fin = new Date(plan.endDate);
    if (Number.isNaN(fin.getTime())) return 0;
    const ms = fin.getTime() - ahora.getTime();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function etiquetaVigencia(plan: Pick<NutricionPlan, "endDate">) {
    const dias = diasRestantes(plan);
    if (dias < 0) return "Plazo vencido";
    if (dias === 0) return "Último día del plazo";
    if (dias === 1) return "Queda 1 día";
    return `Quedan ${dias} días`;
}

/** Suma los macros declarados en los alimentos, para contrastar con los objetivos del plan. */
export function totalesDelPlan(plan: NutricionPlan) {
    return plan.meals.reduce(
        (acc, meal) => {
            for (const item of meal.items) {
                acc.kcal += item.kcal ?? 0;
                acc.proteina += item.proteina ?? 0;
                acc.carbs += item.carbs ?? 0;
                acc.grasas += item.grasas ?? 0;
            }
            return acc;
        },
        { kcal: 0, proteina: 0, carbs: 0, grasas: 0 }
    );
}

export function formatMacro(value: number | null, sufijo: string) {
    if (value == null) return "—";
    const redondeado = Math.round(value * 10) / 10;
    return `${redondeado}${sufijo}`;
}
