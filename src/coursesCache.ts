import { downloadExcelFileWithLastModified, getRawRows } from "./excelSource.js";
import { parseCoursSheet } from "./courseParser.js";
import { getFileUrl } from "./fileFinder.js";
import { semestreToFileType } from "./semestre.js";
import { parseLinkTextDate, formatDateOnly } from "./dateUtils.js";
import type { Semestre } from "./semestre.js";

type Cours = ReturnType<typeof parseCoursSheet>[number];

export interface CoursesResult {
  dateFichier: string | null;
  cours: Cours[];
}

const CACHE_DURATION_MS = 6 * 60 * 60 * 1000;

interface CacheEntry {
  url: string | null;
  cours: Cours[] | null;
  dateFichier: string | null;
  readAt: Date | null;
}

const cache: Record<Semestre, CacheEntry> = {
  automne: { url: null, cours: null, dateFichier: null, readAt: null },
  printemps: { url: null, cours: null, dateFichier: null, readAt: null },
};

function resolveDateFichier(linkText: string, lastModified: Date | null): string | null {
  const fromLinkText = parseLinkTextDate(linkText);
  if (fromLinkText) {
    return fromLinkText;
  }
  if (lastModified) {
    return formatDateOnly(lastModified);
  }
  return null;
}

export async function getCachedCourses(semestre: Semestre): Promise<CoursesResult> {
  const { url, linkText } = await getFileUrl(semestreToFileType(semestre));
  const entry = cache[semestre];
  const now = Date.now();

  const isFresh =
    entry.cours !== null &&
    entry.url === url &&
    entry.readAt !== null &&
    now - entry.readAt.getTime() < CACHE_DURATION_MS;

  if (isFresh && entry.cours) {
    return { dateFichier: entry.dateFichier, cours: entry.cours };
  }

  try {
    console.log(`[coursesCache] Téléchargement et lecture du fichier pour ${semestre} : ${url}`);
    const { buffer, lastModified } = await downloadExcelFileWithLastModified(url);
    const rows = getRawRows(buffer, "Horaire", Infinity);
    const cours = parseCoursSheet(rows);
    const dateFichier = resolveDateFichier(linkText, lastModified);

    entry.url = url;
    entry.cours = cours;
    entry.dateFichier = dateFichier;
    entry.readAt = new Date();

    return { dateFichier, cours };
  } catch (err) {
    if (entry.cours && entry.url === url) {
      console.warn(
        `[coursesCache] Échec du téléchargement/lecture pour ${semestre} (${url}), repli sur les cours en cache (lus le ${entry.readAt?.toISOString() ?? "?"}).`,
        err
      );
      return { dateFichier: entry.dateFichier, cours: entry.cours };
    }
    throw err;
  }
}
