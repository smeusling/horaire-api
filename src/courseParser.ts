import { excelSerialToDate, formatDateOnly } from "./dateUtils.js";

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

export function formatHeure(value: number): string | null {
  const totalValue = Math.round(value * 100);
  const hours = Math.floor(totalValue / 100);
  const minutes = totalValue % 100;

  if (minutes >= 60) {
    return null;
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}`;
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

function getValueByNames(row: any[], columnMap: Record<string, number>, columnNames: string[]): any {
  for (const columnName of columnNames) {
    const index = columnMap[columnName];
    if (index !== undefined) {
      return row[index];
    }
  }
  return undefined;
}

function getTextValueByNames(row: any[], columnMap: Record<string, number>, columnNames: string[]): string {
  const value = getValueByNames(row, columnMap, columnNames);
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function isRowEmpty(row: any[] | undefined): boolean {
  return !row || row.every((cell) => cell === null || cell === undefined || cell === "");
}

export function parseCoursSheet(rows: any[][]) {
  const columnMap = buildColumnMap(rows[1] ?? []);
  const cours = [];
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row || isRowEmpty(row)) continue;
    cours.push(parseCoursRow(row, columnMap));
  }
  return cours;
}

export function parseCoursRow(row: any[], columnMap: Record<string, number>) {
  const dateSerial = getValue(row, columnMap, "date");
  const heureDebutValue = getValue(row, columnMap, "heure début");
  const heureFinValue = getValue(row, columnMap, "heure fin");

  const date = typeof dateSerial === "number" ? formatDateOnly(excelSerialToDate(dateSerial)) : undefined;
  const cours = getTextValueByNames(row, columnMap, ["cours", "enseignement"]);

  let heureDebut: string | undefined;
  if (typeof heureDebutValue === "number") {
    const formatted = formatHeure(heureDebutValue);
    if (formatted === null) {
      console.warn(
        `[courseParser] heureDebut invalide : valeur brute ${heureDebutValue}, date ${date ?? "?"}, cours "${cours}".`
      );
    } else {
      heureDebut = formatted;
    }
  }

  let heureFin: string | undefined;
  if (typeof heureFinValue === "number") {
    const formatted = formatHeure(heureFinValue);
    if (formatted === null) {
      console.warn(
        `[courseParser] heureFin invalide : valeur brute ${heureFinValue}, date ${date ?? "?"}, cours "${cours}".`
      );
    } else {
      heureFin = formatted;
    }
  }

  return {
    date,
    heureDebut,
    heureFin,
    cours,
    contenuCours: getTextValue(row, columnMap, "contenu du cours"),
    volee: getTextValue(row, columnMap, "volée"),
    option: getTextValue(row, columnMap, "option"),
    enseignant: getTextValue(row, columnMap, "enseignant"),
    salle: getTextValue(row, columnMap, "salle"),
  };
}
