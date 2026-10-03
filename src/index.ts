import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { downloadExcelFile, listSheetNames, getRawRows } from "./excelSource.js";
import { excelSerialToDate } from "./dateUtils.js";
import { parseCoursSheet } from "./courseParser.js";
import {
  buildVoleeCatalog,
  voleeKey,
  parseVoleeKey,
  courseMatches,
  MODALITES,
  MODALITE_LABELS,
  OPTIONS,
  OPTION_LABELS,
  type ModaliteId,
  type OptionId,
} from "./voleeCatalog.js";
import { FileNotFoundError } from "./fileFinder.js";
import { SEMESTRES } from "./semestre.js";
import type { Semestre } from "./semestre.js";
import { getCachedCourses } from "./coursesCache.js";
import type { FastifyError, FastifyReply } from "fastify";

const ALLOWED_ORIGINS = ["https://smeusling.github.io", "http://localhost:5173"];

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

await fastify.register(cors, {
  origin: ALLOWED_ORIGINS,
  methods: ["GET"],
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
      summary: "Liste les volées disponibles pour un semestre donné, avec leurs modalités et options.",
      querystring: voleesQuerystringSchema,
      response: {
        200: {
          type: "array",
          items: {
            type: "object",
            properties: {
              volee: { type: "string", description: "Identifiant de la volée (ex: 'IPS 2025')." },
              modalites: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", enum: MODALITES },
                    label: { type: "string" },
                  },
                  required: ["id", "label"],
                },
              },
              options: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", enum: OPTIONS },
                    label: { type: "string" },
                  },
                  required: ["id", "label"],
                },
              },
            },
            required: ["volee", "modalites", "options"],
          },
        },
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
      const catalogue = buildVoleeCatalog(cours);
      return catalogue.map((info) => ({
        volee: voleeKey(info.volee),
        modalites: info.modalites.map((id) => ({ id, label: MODALITE_LABELS[id] })),
        options: info.options.map((id) => ({ id, label: OPTION_LABELS[id] })),
      }));
    } catch (err) {
      sendScheduleError(err, semestre, reply);
    }
  }
);

const scheduleQuerystringSchema = {
  type: "object",
  required: ["volee", "semestre"],
  properties: {
    volee: {
      type: "string",
      minLength: 1,
      description:
        "Identifiant de la volée à filtrer, au format renvoyé par /api/volees (ex: 'IPS 2025'). Obligatoire.",
    },
    modalite: {
      type: "string",
      enum: MODALITES,
      description:
        "Identifiant de modalité à filtrer (facultatif), parmi ceux renvoyés par /api/volees pour cette volée.",
    },
    option: {
      type: "string",
      enum: OPTIONS,
      description:
        "Identifiant d'option à filtrer (facultatif), parmi ceux renvoyés par /api/volees pour cette volée.",
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
    modalite?: ModaliteId;
    option?: OptionId;
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
      const targetVolee = parseVoleeKey(volee);

      if (!targetVolee) {
        return { dateFichier, cours: [] };
      }

      const filtered = cours.filter((c) => courseMatches(c, targetVolee, modalite, option));
      const sorted = [...filtered].sort((a, b) => {
        const dateA = a.date ?? "";
        const dateB = b.date ?? "";
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        const heureA = a.heureDebut ?? "";
        const heureB = b.heureDebut ?? "";
        return heureA.localeCompare(heureB);
      });

      return { dateFichier, cours: sorted };
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
