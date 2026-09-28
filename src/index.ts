import Fastify from "fastify";
import { downloadExcelFile, listSheetNames, getRawRows } from "./excelSource.js";
import { excelSerialToDate } from "./dateUtils.js";
import { parseCoursSheet } from "./courseParser.js";
import { extractVolees, matchesVolee, matchesModalite, matchesOption, filterCourses } from "./voleeParser.js";
import { generateFileUrls, findMostRecentFileUrl, getFileUrl, FileNotFoundError } from "./fileFinder.js";
import { SEMESTRES, semestreToFileType } from "./semestre.js";
import type { Semestre } from "./semestre.js";
import type { FastifyError, FastifyReply } from "fastify";

const fastify = Fastify();

fastify.addHook("onRequest", async (request, reply) => {
  if (request.url.startsWith("/debug") && process.env.NODE_ENV === "production") {
    reply.code(404).send({ error: "Not Found" });
  }
});

fastify.setErrorHandler((err: FastifyError, request, reply) => {
  if (err.validation) {
    reply.code(400).send({ error: err.message });
    return;
  }
  reply.code(err.statusCode ?? 500).send({ error: err.message });
});

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

const voleesQuerystringSchema = {
  type: "object",
  required: ["semestre"],
  properties: {
    semestre: { type: "string", enum: SEMESTRES },
  },
};

async function loadCourses(semestre: Semestre) {
  const fileType = semestreToFileType(semestre);
  const url = await getFileUrl(fileType);
  const buffer = await downloadExcelFile(url);
  const rows = getRawRows(buffer, "Horaire", Infinity);
  return parseCoursSheet(rows);
}

function sendScheduleError(err: unknown, semestre: Semestre, reply: FastifyReply): void {
  if (err instanceof FileNotFoundError) {
    reply.code(404).send({
      error: "Horaire non disponible",
      message: `Aucun horaire trouvé pour le semestre de ${semestre} ${err.year}. Il n'a peut-être pas encore été publié.`,
    });
    return;
  }
  reply.code(500).send({ error: err instanceof Error ? err.message : String(err) });
}

fastify.get<{ Querystring: { semestre: Semestre } }>(
  "/api/volees",
  { schema: { querystring: voleesQuerystringSchema } },
  async (request, reply) => {
    const semestre = request.query.semestre;
    try {
      const cours = await loadCourses(semestre);
      return extractVolees(cours);
    } catch (err) {
      sendScheduleError(err, semestre, reply);
    }
  }
);

const scheduleQuerystringSchema = {
  type: "object",
  required: ["volee", "modalite", "semestre"],
  properties: {
    volee: { type: "string", minLength: 1 },
    modalite: { type: "string", minLength: 1 },
    option: { type: "string" },
    semestre: { type: "string", enum: SEMESTRES },
  },
};

fastify.get<{
  Querystring: {
    volee: string;
    modalite: string;
    option?: string;
    semestre: Semestre;
  };
}>(
  "/api/schedule",
  { schema: { querystring: scheduleQuerystringSchema } },
  async (request, reply) => {
    const { volee, modalite, option, semestre } = request.query;

    try {
      const cours = await loadCourses(semestre);
      const selectedModalites = modalite.split(",").map((m) => m.trim());
      const result = filterCourses(cours, volee, selectedModalites, option);
      return result;
    } catch (err) {
      sendScheduleError(err, semestre, reply);
    }
  }
);

fastify.get("/debug/candidate-urls", async () => {
  return generateFileUrls("coursAutomne", 30);
});

fastify.get("/debug/find-latest", async (request, reply) => {
  try {
    const result = await findMostRecentFileUrl("coursAutomne");
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
