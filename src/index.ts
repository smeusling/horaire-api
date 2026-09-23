import Fastify from "fastify";
import { downloadExcelFile, listSheetNames, getRawRows } from "./excelSource.js";
import { excelSerialToDate } from "./dateUtils.js";
import { buildColumnMap, parseCoursRow } from "./courseParser.js";

const fastify = Fastify();

fastify.get("/health", async () => {
  return { status: "ok" };
});

fastify.get("/debug/sheets", async (request, reply) => {
  try {
    const buffer = await downloadExcelFile(
      "https://www.unil.ch/files/live/sites/fbm/files/06-espaces/sciences-infirmieres/20260918_horaire_automne_2026.xlsx"
    );
    const sheetNames = listSheetNames(buffer);
    return sheetNames;
  } catch (err) {
    reply.code(500);
    return { error: err instanceof Error ? err.message : String(err) };
  }
});

fastify.get("/debug/rows", async (request, reply) => {
  try {
    const buffer = await downloadExcelFile(
      "https://www.unil.ch/files/live/sites/fbm/files/06-espaces/sciences-infirmieres/20260918_horaire_automne_2026.xlsx"
    );
    const rows = getRawRows(buffer, "Horaire", 5);
    return rows;
  } catch (err) {
    reply.code(500);
    return { error: err instanceof Error ? err.message : String(err) };
  }
});

fastify.get("/debug/date-test", async () => {
  const date = excelSerialToDate(46279);
  return date.toUTCString();
});

fastify.get("/debug/parsed", async (request, reply) => {
  try {
    const buffer = await downloadExcelFile(
      "https://www.unil.ch/files/live/sites/fbm/files/06-espaces/sciences-infirmieres/20260918_horaire_automne_2026.xlsx"
    );
    const rows = getRawRows(buffer, "Horaire", 5);
    const columnMap = buildColumnMap(rows[1]);
    const dataRows = rows.slice(2, 5);
    const parsed = dataRows.map((row) => parseCoursRow(row, columnMap));
    return parsed;
  } catch (err) {
    reply.code(500);
    return { error: err instanceof Error ? err.message : String(err) };
  }
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
    console.log("Serveur démarré sur http://localhost:3000");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
