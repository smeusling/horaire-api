import { fetchHorairesPage, extractXlsxLinks, findLinksForFileType, HORAIRES_PAGE_URL, USER_AGENT } from "./horairesPage.js";

export type FileType = "coursAutomne" | "coursPrintemps" | "examensAutomne" | "examensPrintemps";

const FILE_TYPE_YEAR_RULES: Record<FileType, (today: Date) => number> = {
  coursAutomne: (today) => today.getFullYear(),
  coursPrintemps: (today) => {
    const month = today.getMonth() + 1;
    return month >= 9 ? today.getFullYear() + 1 : today.getFullYear();
  },
  examensAutomne: (today) => {
    const month = today.getMonth() + 1;
    return month <= 2 ? today.getFullYear() - 1 : today.getFullYear();
  },
  examensPrintemps: (today) => today.getFullYear(),
};

export function computeFileYear(fileType: FileType, today: Date = new Date()): number {
  return FILE_TYPE_YEAR_RULES[fileType](today);
}

export class FileNotFoundError extends Error {
  constructor(
    public readonly fileType: FileType,
    public readonly year: number
  ) {
    super(`Aucun fichier trouvé pour le type "${fileType}" (année ${year}).`);
    this.name = "FileNotFoundError";
  }
}

interface FoundFile {
  url: string;
  linkText: string;
  lastModified: Date | null;
}

const HEAD_TIMEOUT_MS = 10_000;

async function resolveFileFromHorairesPage(fileType: FileType): Promise<FoundFile | null> {
  const html = await fetchHorairesPage();
  const allLinks = extractXlsxLinks(html, HORAIRES_PAGE_URL);

  if (allLinks.length === 0) {
    throw new Error(
      `Aucun lien .xlsx trouvé sur la page des horaires (${HORAIRES_PAGE_URL}) : la structure de la page a peut-être changé.`
    );
  }

  const year = computeFileYear(fileType);
  const matchingLinks = findLinksForFileType(allLinks, fileType, year);

  if (matchingLinks.length === 0) {
    return null;
  }

  if (matchingLinks.length === 1) {
    const [link] = matchingLinks;
    if (link) {
      console.log(`[fileFinder] Fichier retenu pour ${fileType} : "${link.fileName}" (${link.url})`);
      return { url: link.url, linkText: link.text, lastModified: null };
    }
  }

  let best: FoundFile | null = null;
  let anyHeadFailed = false;

  for (const link of matchingLinks) {
    let response: Response;
    try {
      response = await fetch(link.url, {
        method: "HEAD",
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(HEAD_TIMEOUT_MS),
      });
    } catch {
      anyHeadFailed = true;
      continue;
    }

    const lastModifiedHeader = response.headers.get("last-modified");
    if (!response.ok || !lastModifiedHeader) {
      anyHeadFailed = true;
      continue;
    }

    const lastModified = new Date(lastModifiedHeader);
    if (!best || !best.lastModified || lastModified > best.lastModified) {
      best = { url: link.url, linkText: link.text, lastModified };
    }
  }

  if (!best) {
    throw new Error(
      `${matchingLinks.length} liens correspondent à ${fileType} ${year}, mais aucune requête HEAD n'a permis de déterminer le plus récent.`
    );
  }

  if (anyHeadFailed) {
    console.warn(
      `[fileFinder] Au moins une requête HEAD a échoué parmi ${matchingLinks.length} liens candidats pour ${fileType} ${year} ; retenu malgré tout : ${best.url}`
    );
  }

  console.log(
    `[fileFinder] Fichier retenu pour ${fileType} (le plus récent parmi ${matchingLinks.length} liens) : ${best.url}`
  );
  return best;
}

const CACHE_DURATION_MS = 6 * 60 * 60 * 1000;
const NOT_FOUND_CACHE_DURATION_MS = 60 * 60 * 1000;

type CacheEntry = {
  result: FoundFile | null;
  resultYear: number | null;
  cachedAt: Date | null;
  notFoundYear: number | null;
  notFoundCachedAt: Date | null;
};

const cache: Record<FileType, CacheEntry> = {
  coursAutomne: { result: null, resultYear: null, cachedAt: null, notFoundYear: null, notFoundCachedAt: null },
  coursPrintemps: { result: null, resultYear: null, cachedAt: null, notFoundYear: null, notFoundCachedAt: null },
  examensAutomne: { result: null, resultYear: null, cachedAt: null, notFoundYear: null, notFoundCachedAt: null },
  examensPrintemps: { result: null, resultYear: null, cachedAt: null, notFoundYear: null, notFoundCachedAt: null },
};

export async function getFileUrl(fileType: FileType): Promise<string> {
  const now = Date.now();
  const entry = cache[fileType];
  const currentYear = computeFileYear(fileType);

  const hasFreshResult =
    entry.result !== null &&
    entry.resultYear === currentYear &&
    entry.cachedAt !== null &&
    now - entry.cachedAt.getTime() < CACHE_DURATION_MS;

  if (hasFreshResult && entry.result) {
    return entry.result.url;
  }

  const hasFreshNotFound =
    entry.notFoundYear === currentYear &&
    entry.notFoundCachedAt !== null &&
    now - entry.notFoundCachedAt.getTime() < NOT_FOUND_CACHE_DURATION_MS;

  if (hasFreshNotFound) {
    if (entry.result && entry.resultYear === currentYear) {
      return entry.result.url;
    }
    throw new FileNotFoundError(fileType, currentYear);
  }

  let result: FoundFile | null;
  try {
    result = await resolveFileFromHorairesPage(fileType);
  } catch (err) {
    if (entry.result && entry.resultYear === currentYear) {
      return entry.result.url;
    }
    throw err;
  }

  if (result) {
    entry.result = result;
    entry.resultYear = currentYear;
    entry.cachedAt = new Date();
    entry.notFoundYear = null;
    entry.notFoundCachedAt = null;
    return result.url;
  }

  entry.notFoundYear = currentYear;
  entry.notFoundCachedAt = new Date();

  if (entry.result && entry.resultYear === currentYear) {
    return entry.result.url;
  }

  throw new FileNotFoundError(fileType, currentYear);
}
