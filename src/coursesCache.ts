import { downloadExcelFile, getRawRows } from "./excelSource.js";
import { parseCoursSheet } from "./courseParser.js";
import { getFileUrl } from "./fileFinder.js";
import { semestreToFileType } from "./semestre.js";
import type { Semestre } from "./semestre.js";

type Cours = ReturnType<typeof parseCoursSheet>[number];

const CACHE_DURATION_MS = 6 * 60 * 60 * 1000;

interface CacheEntry {
  url: string | null;
  cours: Cours[] | null;
  readAt: Date | null;
}

const cache: Record<Semestre, CacheEntry> = {
  automne: { url: null, cours: null, readAt: null },
  printemps: { url: null, cours: null, readAt: null },
};

export async function getCachedCourses(semestre: Semestre): Promise<Cours[]> {
  const url = await getFileUrl(semestreToFileType(semestre));
  const entry = cache[semestre];
  const now = Date.now();

  const isFresh =
    entry.cours !== null &&
    entry.url === url &&
    entry.readAt !== null &&
    now - entry.readAt.getTime() < CACHE_DURATION_MS;

  if (isFresh && entry.cours) {
    return entry.cours;
  }

  try {
    console.log(`[coursesCache] Téléchargement et lecture du fichier pour ${semestre} : ${url}`);
    const buffer = await downloadExcelFile(url);
    const rows = getRawRows(buffer, "Horaire", Infinity);
    const cours = parseCoursSheet(rows);

    entry.url = url;
    entry.cours = cours;
    entry.readAt = new Date();

    return cours;
  } catch (err) {
    if (entry.cours && entry.url === url) {
      console.warn(
        `[coursesCache] Échec du téléchargement/lecture pour ${semestre} (${url}), repli sur les cours en cache (lus le ${entry.readAt?.toISOString() ?? "?"}).`,
        err
      );
      return entry.cours;
    }
    throw err;
  }
}
