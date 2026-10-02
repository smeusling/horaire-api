import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { downloadExcelFile, listSheetNames, getRawRows } from "./excelSource.js";
import { excelSerialToDate } from "./dateUtils.js";
import { parseCoursSheet } from "./courseParser.js";
import { extractVolees, matchesVolee, matchesModalite, matchesOption, filterCourses } from "./voleeParser.js";
import { FileNotFoundError } from "./fileFinder.js";
import { SEMESTRES } from "./semestre.js";
import type { Semestre } from "./semestre.js";
import { getCachedCourses } from "./coursesCache.js";
import type { FastifyError, FastifyReply } from "fastify";

const fastify = Fastify();

const isProduction = process.env.NODE_ENV === "production";

fastify.addHook("onRequest", async (request, reply) => {
  if (request.url.startsWith("/debug") && isProduction) {
    reply.code(404).send({ error: "Not Found" });
  }
});

function send500Error(err: unknown, reply: FastifyReply): void {
  console.error(err);
  const message = err instanceof Error ? err.message : String(err);
  reply.code(500).send({
    error: isProduction ? "Erreur interne du serveur. Veuillez réessayer plus tard." : message,
  });
}

fastify.setErrorHandler((err: FastifyError, request, reply) => {
  if (err.validation) {
    reply.code(400).send({ error: err.message });
    return;
  }

  const statusCode = err.statusCode ?? 500;
  if (statusCode < 500) {
    reply.code(statusCode).send({ error: err.message });
    return;
  }

  send500Error(err, reply);
});

await fastify.register(swagger, {
  openapi: {
    info: {
      title: "API Horaires Cours",
      description:
        "API qui récupère et filtre les horaires de cours publiés par l'UNIL (sciences infirmières) par semestre, volée, modalité et option.",
      version: "1.0.0",
    },
  },
  transform: ({ schema, url }) => {
    const transformedSchema = { ...schema };
    if (url.startsWith("/debug")) {
      transformedSchema.hide = true;
    }
    return { schema: transformedSchema, url };
  },
});

await fastify.register(swaggerUi, {
  routePrefix: "/documentation",
});

fastify.get("/health", { schema: { summary: "Vérifie que le serveur est démarré." } }, async () => {
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

const errorSchema = {
  type: "object",
  properties: { error: { type: "string" } },
  required: ["error"],
};

const notFoundSchema = {
  type: "object",
  properties: {
    error: { type: "string" },
    message: { type: "string" },
  },
  required: ["error", "message"],
};

const voleesQuerystringSchema = {
  type: "object",
  required: ["semestre"],
  properties: {
    semestre: {
      type: "string",
      enum: SEMESTRES,
      description: "Semestre pour lequel récupérer les données ('automne' ou 'printemps'). Obligatoire.",
    },
  },
};

function sendScheduleError(err: unknown, semestre: Semestre, reply: FastifyReply): void {
  if (err instanceof FileNotFoundError) {
    reply.code(404).send({
      error: "Horaire non disponible",
      message: `Aucun horaire trouvé pour le semestre de ${semestre} ${err.year}. Il n'a peut-être pas encore été publié.`,
    });
    return;
  }
  send500Error(err, reply);
}

fastify.get<{ Querystring: { semestre: Semestre } }>(
  "/api/volees",
  {
    schema: {
      summary: "Liste les volées disponibles pour un semestre donné.",
      querystring: voleesQuerystringSchema,
      response: {
        200: { type: "array", items: { type: "string" } },
        400: errorSchema,
        404: notFoundSchema,
        500: errorSchema,
      },
    },
  },
  async (request, reply) => {
    const semestre = request.query.semestre;
    try {
      const { cours } = await getCachedCourses(semestre);
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
    volee: {
      type: "string",
      minLength: 1,
      description: "Nom de la volée à filtrer, tel que retourné par /api/volees (ex: 'IPS 2026'). Obligatoire.",
    },
    modalite: {
      type: "string",
      minLength: 1,
      description:
        "Modalité(s) à inclure, séparées par une virgule : 'tempsPlein', 'partiel', ou les deux ('tempsPlein,partiel'). Obligatoire.",
    },
    option: {
      type: "string",
      description:
        "Filtre optionnel sur l'orientation/l'option du cours (ex: 'Soins primaires'). Si absent, aucun filtre n'est appliqué sur ce champ.",
    },
    semestre: {
      type: "string",
      enum: SEMESTRES,
      description: "Semestre pour lequel récupérer les données ('automne' ou 'printemps'). Obligatoire.",
    },
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
  {
    schema: {
      summary: "Renvoie les cours filtrés par semestre, volée, modalité et option.",
      querystring: scheduleQuerystringSchema,
      response: {
        200: {
          type: "object",
          properties: {
            dateFichier: {
              type: ["string", "null"],
              description: "Date du fichier source publié par l'UNIL (YYYY-MM-DD), ou null si inconnue.",
            },
            cours: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  date: { type: "string", description: "Date du cours (YYYY-MM-DD)" },
                  heureDebut: { type: "string", description: "Heure de début (HH:MM)" },
                  heureFin: { type: "string", description: "Heure de fin (HH:MM)" },
                  cours: { type: "string" },
                  contenuCours: { type: "string" },
                  volee: { type: "string" },
                  option: { type: "string" },
                  enseignant: { type: "string" },
                  salle: { type: "string" },
                },
                required: ["cours", "contenuCours", "volee", "option", "enseignant", "salle"],
              },
            },
          },
          required: ["dateFichier", "cours"],
        },
        400: errorSchema,
        404: notFoundSchema,
        500: errorSchema,
      },
    },
  },
  async (request, reply) => {
    const { volee, modalite, option, semestre } = request.query;

    try {
      const { dateFichier, cours } = await getCachedCourses(semestre);
      const selectedModalites = modalite.split(",").map((m) => m.trim());
      const result = filterCourses(cours, volee, selectedModalites, option);
      return { dateFichier, cours: result };
    } catch (err) {
      sendScheduleError(err, semestre, reply);
    }
  }
);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const HOST = isProduction ? "0.0.0.0" : "127.0.0.1";

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`Serveur démarré sur le port ${PORT}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
