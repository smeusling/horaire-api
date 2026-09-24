import Fastify from "fastify";
import { downloadExcelFile, listSheetNames, getRawRows } from "./excelSource.js";
import { excelSerialToDate } from "./dateUtils.js";
import { parseCoursSheet } from "./courseParser.js";
import { extractVolees, matchesVolee } from "./voleeParser.js";

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
    const rows = getRawRows(buffer, "Horaire", Infinity);
    const cours = parseCoursSheet(rows);
    return {
      total: cours.length,
      premiers: cours.slice(0, 5),
    };
  } catch (err) {
    reply.code(500);
    return { error: err instanceof Error ? err.message : String(err) };
  }
});

fastify.get("/debug/mscips-raw", async (request, reply) => {
  try {
    const buffer = await downloadExcelFile(
      "https://www.unil.ch/files/live/sites/fbm/files/06-espaces/sciences-infirmieres/20260918_horaire_automne_2026.xlsx"
    );
    const rows = getRawRows(buffer, "Horaire", Infinity);
    const cours = parseCoursSheet(rows);
    const values = new Set<string>();
    for (const c of cours) {
      if (c.volee && c.volee.toLowerCase().includes("mscips")) {
        values.add(c.volee);
      }
    }
    return Array.from(values).sort();
  } catch (err) {
    reply.code(500);
    return { error: err instanceof Error ? err.message : String(err) };
  }
});

fastify.get("/debug/volees", async (request, reply) => {
  try {
    const buffer = await downloadExcelFile(
      "https://www.unil.ch/files/live/sites/fbm/files/06-espaces/sciences-infirmieres/20260918_horaire_automne_2026.xlsx"
    );
    const rows = getRawRows(buffer, "Horaire", Infinity);
    const cours = parseCoursSheet(rows);
    const volees = extractVolees(cours);
    return volees;
  } catch (err) {
    reply.code(500);
    return { error: err instanceof Error ? err.message : String(err) };
  }
});

fastify.get("/debug/match-test", async () => {
  const cases: { rawVolee: string; selectedVolee: string }[] = [
    { rawVolee: "MScSI Volée 2026 Tous / MScIPS 2026 Tous", selectedVolee: "IPS 2026" },
    { rawVolee: "MScSI Volée 2026 Tous / MScIPS 2026 Tous", selectedVolee: "MScIPS 2026" },
    { rawVolee: "Etudiants Tous MScSI/MScIPS", selectedVolee: "MScIPS 2026" },
    { rawVolee: "Etudiants Tous MScSI/MScIPS", selectedVolee: "MScIPS" },
    { rawVolee: "IPS 2026 Tous", selectedVolee: "IPS 2026" },
    { rawVolee: "IPS 2025 Temps partiel 8 semestres", selectedVolee: "IPS 2025" },
  ];

  return cases.map(({ rawVolee, selectedVolee }) => ({
    rawVolee,
    selectedVolee,
    result: matchesVolee(rawVolee, selectedVolee),
  }));
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
