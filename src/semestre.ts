export const SEMESTRES = ["automne", "printemps"] as const;
export type Semestre = (typeof SEMESTRES)[number];

export function semestreToFileType(semestre: Semestre): "coursAutomne" | "coursPrintemps" {
  return semestre === "automne" ? "coursAutomne" : "coursPrintemps";
}
