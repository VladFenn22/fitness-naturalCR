import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatFecha, type RutinaCliente } from "./rutina";
import { etiquetaVigencia, formatMacro, totalesDelPlan, type NutricionPlan } from "./nutricion";

const styles = StyleSheet.create({
    page: { padding: 32, fontSize: 10, color: "#0F172A", fontFamily: "Helvetica" },
    header: {
        borderBottomWidth: 2,
        borderBottomColor: "#0B2A6F",
        paddingBottom: 10,
        marginBottom: 16,
    },
    brand: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#0B2A6F" },
    title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginTop: 6 },
    metaRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
    meta: { fontSize: 9, color: "#475569", marginRight: 16 },
    plazo: {
        marginBottom: 14,
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 4,
        padding: 10,
    },
    plazoTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#0B2A6F" },
    objetivos: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
    objetivo: { width: "25%" },
    objetivoLabel: { fontSize: 8, color: "#64748B" },
    objetivoValue: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 2 },
    meal: {
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 4,
        padding: 10,
    },
    mealTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#0B2A6F" },
    mealNotes: { fontSize: 9, color: "#475569", marginTop: 3 },
    tableHeader: {
        flexDirection: "row",
        backgroundColor: "#F1F5F9",
        paddingVertical: 5,
        paddingHorizontal: 4,
        marginTop: 8,
    },
    row: {
        flexDirection: "row",
        paddingVertical: 5,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
    },
    th: { fontSize: 9, fontFamily: "Helvetica-Bold" },
    td: { fontSize: 9 },
    colAlimento: { width: "30%" },
    colCantidad: { width: "16%" },
    colKcal: { width: "11%" },
    colProt: { width: "11%" },
    colCarbs: { width: "11%" },
    colGrasas: { width: "11%" },
    colNotas: { width: "10%" },
    totales: {
        flexDirection: "row",
        paddingVertical: 5,
        paddingHorizontal: 4,
        backgroundColor: "#F1F5F9",
        marginTop: 4,
    },
    empty: { fontSize: 9, color: "#94A3B8", marginTop: 8 },
    notas: { fontSize: 9, color: "#475569", marginTop: 10 },
    footer: {
        position: "absolute",
        bottom: 20,
        left: 32,
        right: 32,
        fontSize: 8,
        color: "#94A3B8",
        textAlign: "center",
        borderTopWidth: 1,
        borderTopColor: "#E2E8F0",
        paddingTop: 6,
    },
});

export function NutricionPdfDocument({
    plan,
    client,
}: {
    plan: NutricionPlan;
    client: RutinaCliente;
}) {
    const totales = totalesDelPlan(plan);

    return (
        <Document title={`Plan nutricional · ${plan.title}`}>
            <Page size="A4" style={styles.page}>
                <View style={styles.header}>
                    <Text style={styles.brand}>Fitness Natural CR</Text>
                    <Text style={styles.title}>{plan.title}</Text>
                    <View style={styles.metaRow}>
                        <Text style={styles.meta}>Cliente: {client.nombre ?? client.email ?? "—"}</Text>
                        <Text style={styles.meta}>Coach: {client.coach?.name ?? "—"}</Text>
                    </View>
                </View>

                <View style={styles.plazo}>
                    <Text style={styles.plazoTitle}>
                        Plazo: {formatFecha(plan.startDate)} — {formatFecha(plan.endDate)} (
                        {etiquetaVigencia(plan)})
                    </Text>
                    <View style={styles.objetivos}>
                        <View style={styles.objetivo}>
                            <Text style={styles.objetivoLabel}>Calorías objetivo</Text>
                            <Text style={styles.objetivoValue}>{formatMacro(plan.kcal, " kcal")}</Text>
                        </View>
                        <View style={styles.objetivo}>
                            <Text style={styles.objetivoLabel}>Proteína</Text>
                            <Text style={styles.objetivoValue}>{formatMacro(plan.proteinaG, " g")}</Text>
                        </View>
                        <View style={styles.objetivo}>
                            <Text style={styles.objetivoLabel}>Carbohidratos</Text>
                            <Text style={styles.objetivoValue}>{formatMacro(plan.carbsG, " g")}</Text>
                        </View>
                        <View style={styles.objetivo}>
                            <Text style={styles.objetivoLabel}>Grasas</Text>
                            <Text style={styles.objetivoValue}>{formatMacro(plan.grasasG, " g")}</Text>
                        </View>
                    </View>
                </View>

                {plan.meals.map((meal) => (
                    <View key={meal.id} style={styles.meal} wrap={false}>
                        <Text style={styles.mealTitle}>
                            {meal.name}
                            {meal.time ? ` · ${meal.time}` : ""}
                        </Text>
                        {meal.notes ? <Text style={styles.mealNotes}>{meal.notes}</Text> : null}

                        {meal.items.length === 0 ? (
                            <Text style={styles.empty}>Sin alimentos asignados.</Text>
                        ) : (
                            <View>
                                <View style={styles.tableHeader}>
                                    <Text style={[styles.th, styles.colAlimento]}>Alimento</Text>
                                    <Text style={[styles.th, styles.colCantidad]}>Cantidad</Text>
                                    <Text style={[styles.th, styles.colKcal]}>Kcal</Text>
                                    <Text style={[styles.th, styles.colProt]}>Prot.</Text>
                                    <Text style={[styles.th, styles.colCarbs]}>Carbs</Text>
                                    <Text style={[styles.th, styles.colGrasas]}>Grasas</Text>
                                    <Text style={[styles.th, styles.colNotas]}>Notas</Text>
                                </View>

                                {meal.items.map((item) => (
                                    <View key={item.id} style={styles.row}>
                                        <Text style={[styles.td, styles.colAlimento]}>{item.name}</Text>
                                        <Text style={[styles.td, styles.colCantidad]}>
                                            {item.cantidad ?? "—"}
                                        </Text>
                                        <Text style={[styles.td, styles.colKcal]}>
                                            {formatMacro(item.kcal, "")}
                                        </Text>
                                        <Text style={[styles.td, styles.colProt]}>
                                            {formatMacro(item.proteina, "")}
                                        </Text>
                                        <Text style={[styles.td, styles.colCarbs]}>
                                            {formatMacro(item.carbs, "")}
                                        </Text>
                                        <Text style={[styles.td, styles.colGrasas]}>
                                            {formatMacro(item.grasas, "")}
                                        </Text>
                                        <Text style={[styles.td, styles.colNotas]}>
                                            {item.notes ?? "—"}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                ))}

                <View style={styles.totales}>
                    <Text style={[styles.th, styles.colAlimento]}>Totales del día</Text>
                    <Text style={[styles.td, styles.colCantidad]}> </Text>
                    <Text style={[styles.th, styles.colKcal]}>{Math.round(totales.kcal)}</Text>
                    <Text style={[styles.th, styles.colProt]}>{formatMacro(totales.proteina, "")}</Text>
                    <Text style={[styles.th, styles.colCarbs]}>{formatMacro(totales.carbs, "")}</Text>
                    <Text style={[styles.th, styles.colGrasas]}>{formatMacro(totales.grasas, "")}</Text>
                    <Text style={[styles.td, styles.colNotas]}> </Text>
                </View>

                {plan.notes ? <Text style={styles.notas}>Indicaciones: {plan.notes}</Text> : null}

                <Text style={styles.footer} fixed>
                    Fitness Natural CR · Plan válido del {formatFecha(plan.startDate)} al{" "}
                    {formatFecha(plan.endDate)} · Generado el {formatFecha(new Date().toISOString())}
                </Text>
            </Page>
        </Document>
    );
}
