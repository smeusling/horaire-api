import Fastify from "fastify";
import { downloadExcelFile, listSheetNames, getRawRows } from "./excelSource.js";
import { excelSerialToDate } from "./dateUtils.js";
import { parseCoursSheet } from "./courseParser.js";
import { extractVolees, matchesVolee, matchesModalite, matchesOption, filterCourses } from "./voleeParser.js";
import { generateCoursAutomneUrls, findMostRecentCoursAutomneUrl, getCoursAutomneUrl } from "./fileFinder.js";

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
  const voleeCases: { rawVolee: string; selectedVolee: string }[] = [
    { rawVolee: "MScSI Volée 2026 Tous / MScIPS 2026 Tous", selectedVolee: "IPS 2026" },
    { rawVolee: "MScSI Volée 2026 Tous / MScIPS 2026 Tous", selectedVolee: "MScIPS 2026" },
    { rawVolee: "Etudiants Tous MScSI/MScIPS", selectedVolee: "MScIPS 2026" },
    { rawVolee: "Etudiants Tous MScSI/MScIPS", selectedVolee: "MScIPS" },
    { rawVolee: "IPS 2026 Tous", selectedVolee: "IPS 2026" },
    { rawVolee: "IPS 2025 Temps partiel 8 semestres", selectedVolee: "IPS 2025" },
  ];

  const modaliteCases: { rawVolee: string; selectedVolee: string; selectedModalites: string[] }[] = [
    { rawVolee: "IPS 2025 Temps partiel 8 semestres", selectedVolee: "IPS 2025", selectedModalites: ["partiel"] },
    { rawVolee: "IPS 2025 Temps partiel 8 semestres", selectedVolee: "IPS 2025", selectedModalites: ["tempsPlein"] },
    { rawVolee: "IPS 2026 Tous", selectedVolee: "IPS 2026", selectedModalites: ["tempsPlein"] },
    { rawVolee: "IPS 2026 Tous", selectedVolee: "IPS 2026", selectedModalites: ["partiel"] },
  ];

  const optionCases: { courseOption: string; selectedOption: string }[] = [
    { courseOption: "Tous", selectedOption: "Soins primaires" },
    { courseOption: "", selectedOption: "Soins primaires" },
    { courseOption: "Soins primaires", selectedOption: "Soins primaires" },
    { courseOption: "primaires/adultes", selectedOption: "Soins aux enfants" },
    { courseOption: "primaires/adultes", selectedOption: "Soins primaires" },
  ];

  return {
    matchesVolee: voleeCases.map(({ rawVolee, selectedVolee }) => ({
      rawVolee,
      selectedVolee,
      result: matchesVolee(rawVolee, selectedVolee),
    })),
    matchesModalite: modaliteCases.map(({ rawVolee, selectedVolee, selectedModalites }) => ({
      rawVolee,
      selectedVolee,
      selectedModalites,
      result: matchesModalite(rawVolee, selectedVolee, selectedModalites),
    })),
    matchesOption: optionCases.map(({ courseOption, selectedOption }) => ({
      courseOption,
      selectedOption,
      result: matchesOption(courseOption, selectedOption),
    })),
  };
});

fastify.get("/api/volees", async (request, reply) => {
  try {
    const url = await getCoursAutomneUrl();
    const buffer = await downloadExcelFile(url);
    const rows = getRawRows(buffer, "Horaire", Infinity);
    const cours = parseCoursSheet(rows);
    return extractVolees(cours);
  } catch (err) {
    reply.code(500);
    return { error: err instanceof Error ? err.message : String(err) };
  }
});

fastify.get("/api/schedule", async (request, reply) => {
  const query = request.query as {
    volee?: string;
    modalite?: string;
    option?: string;
  };

  if (!query.volee || !query.modalite) {
    reply.code(400);
    return { error: "Les paramètres 'volee' et 'modalite' sont requis." };
  }

  try {
    const url = await getCoursAutomneUrl();
    const buffer = await downloadExcelFile(url);
    const rows = getRawRows(buffer, "Horaire", Infinity);
    const cours = parseCoursSheet(rows);
    const selectedModalites = query.modalite.split(",").map((m) => m.trim());
    const result = filterCourses(cours, query.volee, selectedModalites, query.option);
    return result;
  } catch (err) {
    reply.code(500);
    return { error: err instanceof Error ? err.message : String(err) };
  }
});

fastify.get("/debug/candidate-urls", async () => {
  return generateCoursAutomneUrls(30);
});

fastify.get("/debug/find-latest", async (request, reply) => {
  try {
    const result = await findMostRecentCoursAutomneUrl();
    if (!result) {
      reply.code(404);
      return { error: "Aucun fichier trouvé parmi les URLs candidates." };
    }
    return result;
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
