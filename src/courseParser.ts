import { excelSerialToDate } from "./dateUtils.js";

export function buildColumnMap(headerRow: any[]): Record<string, number> {
  const columnMap: Record<string, number> = {};
  headerRow.forEach((cell, index) => {
    if (cell === null || cell === undefined) return;
    const key = String(cell).trim().replace(/\s+/g, " ").toLowerCase();
    if (key) {
      columnMap[key] = index;
    }
  });
  return columnMap;
}

export function formatHeure(value: number): string {
  const totalMinutes = Math.round(value * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}`;
}

function formatDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getValue(row: any[], columnMap: Record<string, number>, columnName: string): any {
  const index = columnMap[columnName];
  return index !== undefined ? row[index] : undefined;
}

function getTextValue(row: any[], columnMap: Record<string, number>, columnName: string): string {
  const value = getValue(row, columnMap, columnName);
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function parseCoursRow(row: any[], columnMap: Record<string, number>) {
  const dateSerial = getValue(row, columnMap, "date");
  const heureDebutValue = getValue(row, columnMap, "heure début");
  const heureFinValue = getValue(row, columnMap, "heure fin");

  return {
    date: typeof dateSerial === "number" ? formatDateOnly(excelSerialToDate(dateSerial)) : undefined,
    heureDebut: typeof heureDebutValue === "number" ? formatHeure(heureDebutValue) : undefined,
    heureFin: typeof heureFinValue === "number" ? formatHeure(heureFinValue) : undefined,
    cours: getTextValue(row, columnMap, "cours"),
    contenuCours: getTextValue(row, columnMap, "contenu du cours"),
    volee: getTextValue(row, columnMap, "volée"),
    option: getTextValue(row, columnMap, "option"),
    enseignant: getTextValue(row, columnMap, "enseignant"),
    salle: getTextValue(row, columnMap, "salle"),
  };
}
