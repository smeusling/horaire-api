import * as XLSX from "xlsx";
import { USER_AGENT } from "./horairesPage.js";

const DOWNLOAD_TIMEOUT_MS = 10_000;

export async function downloadExcelFile(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });

  if (response.status !== 200) {
    throw new Error(`Impossible de télécharger le fichier (${url}) : statut HTTP ${response.status}.`);
  }

  return response.arrayBuffer();
}

export function listSheetNames(buffer: ArrayBuffer): string[] {
  const workbook = XLSX.read(buffer);
  return workbook.SheetNames;
}

export function getRawRows(
  buffer: ArrayBuffer,
  sheetName: string,
  maxRows: number
): unknown[][] {
  const workbook = XLSX.read(buffer);
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    const availableSheets = workbook.SheetNames.map((name) => `"${name}"`).join(", ");
    throw new Error(
      `Feuille "${sheetName}" introuvable dans le fichier. Feuilles disponibles : ${availableSheets}.`
    );
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  return rows.slice(0, maxRows);
}
