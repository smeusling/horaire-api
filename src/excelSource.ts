import * as XLSX from "xlsx";

export async function downloadExcelFile(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
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
