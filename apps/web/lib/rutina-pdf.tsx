import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import {
    formatDescanso,
    formatFecha,
    nombreDia,
    type RutinaCliente,
    type RutinaPlan,
} from "./rutina";

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
    day: {
        marginBottom: 14,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 4,
        padding: 10,
    },
    dayTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#0B2A6F" },
    dayNotes: { fontSize: 9, color: "#475569", marginTop: 3 },
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
    colEjercicio: { width: "32%" },
    colSets: { width: "9%" },
    colReps: { width: "12%" },
    colRir: { width: "9%" },
    colDescanso: { width: "13%" },
    colNotas: { width: "25%" },
    empty: { fontSize: 9, color: "#94A3B8", marginTop: 8 },
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

export function RutinaPdfDocument({
    plan,
    client,
}: {
    plan: RutinaPlan;
    client: RutinaCliente;
}) {
    return (
        <Document title={plan.title} author="Fitness Natural CR">
            <Page size="A4" style={styles.page}>
                <View style={styles.header}>
                    <Text style={styles.brand}>Fitness Natural CR</Text>
                    <Text style={styles.title}>{plan.title}</Text>
                    <View style={styles.metaRow}>
                        <Text style={styles.meta}>Cliente: {client.nombre ?? client.email ?? "—"}</Text>
                        <Text style={styles.meta}>Coach: {client.coach?.name ?? "—"}</Text>
                        <Text style={styles.meta}>Inicio: {formatFecha(plan.startDate)}</Text>
                        <Text style={styles.meta}>Fin: {formatFecha(plan.endDate)}</Text>
                    </View>
                </View>

                {plan.days.length === 0 ? (
                    <Text style={styles.empty}>Esta rutina todavía no tiene días configurados.</Text>
                ) : (
                    plan.days.map((day) => (
                        <View key={day.id} style={styles.day} wrap={false}>
                            <Text style={styles.dayTitle}>
                                {nombreDia(day.dayOfWeek)}
                                {day.name ? ` · ${day.name}` : ""}
                            </Text>
                            {day.notes ? <Text style={styles.dayNotes}>{day.notes}</Text> : null}

                            {day.exercises.length === 0 ? (
                                <Text style={styles.empty}>Sin ejercicios asignados.</Text>
                            ) : (
                                <>
                                    <View style={styles.tableHeader}>
                                        <Text style={[styles.th, styles.colEjercicio]}>Ejercicio</Text>
                                        <Text style={[styles.th, styles.colSets]}>Series</Text>
                                        <Text style={[styles.th, styles.colReps]}>Reps</Text>
                                        <Text style={[styles.th, styles.colRir]}>RIR</Text>
                                        <Text style={[styles.th, styles.colDescanso]}>Descanso</Text>
                                        <Text style={[styles.th, styles.colNotas]}>Notas</Text>
                                    </View>

                                    {day.exercises.map((ex) => (
                                        <View key={ex.id} style={styles.row}>
                                            <Text style={[styles.td, styles.colEjercicio]}>{ex.name}</Text>
                                            <Text style={[styles.td, styles.colSets]}>{ex.sets ?? "—"}</Text>
                                            <Text style={[styles.td, styles.colReps]}>{ex.reps ?? "—"}</Text>
                                            <Text style={[styles.td, styles.colRir]}>{ex.rir ?? "—"}</Text>
                                            <Text style={[styles.td, styles.colDescanso]}>
                                                {formatDescanso(ex.restSec)}
                                            </Text>
                                            <Text style={[styles.td, styles.colNotas]}>{ex.notes ?? "—"}</Text>
                                        </View>
                                    ))}
                                </>
                            )}
                        </View>
                    ))
                )}

                <Text style={styles.footer} fixed>
                    Fitness Natural CR · Rutina generada el{" "}
                    {new Date().toLocaleDateString("es-CR")}
                </Text>
            </Page>
        </Document>
    );
}
