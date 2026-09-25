function formatDateYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

type FileType = "coursAutomne" | "coursPrintemps" | "examensAutomne" | "examensPrintemps";

interface FileTypeConfig {
  computeYear(today: Date): number;
  buildFileNames(year: number): [string, string];
}

const FILE_TYPE_CONFIGS: Record<FileType, FileTypeConfig> = {
  coursAutomne: {
    computeYear: (today) => today.getFullYear(),
    buildFileNames: (year) => [`horaire_automne_${year}`, `Horaire_Automne_${year}`],
  },
  coursPrintemps: {
    computeYear: (today) => {
      const month = today.getMonth() + 1;
      return month >= 9 ? today.getFullYear() + 1 : today.getFullYear();
    },
    buildFileNames: (year) => [`horaire_printemps_${year}`, `Horaire_Printemps_${year}`],
  },
  examensAutomne: {
    computeYear: (today) => {
      const month = today.getMonth() + 1;
      return month <= 2 ? today.getFullYear() - 1 : today.getFullYear();
    },
    buildFileNames: (year) => {
      const yy = String(year).slice(-2);
      return [`horaire_examens_a${yy}`, `Horaire_Examens_A${yy}`];
    },
  },
  examensPrintemps: {
    computeYear: (today) => today.getFullYear(),
    buildFileNames: (year) => {
      const yy = String(year).slice(-2);
      return [`horaire_examens_p${yy}`, `Horaire_Examens_P${yy}`];
    },
  },
};

export function generateFileUrls(fileType: FileType, daysBack: number): string[] {
  const urls: string[] = [];
  const today = new Date();
  const config = FILE_TYPE_CONFIGS[fileType];
  const year = config.computeYear(today);
  const [lowerName, upperName] = config.buildFileNames(year);

  for (let i = 0; i <= daysBack; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const formatted = formatDateYYYYMMDD(date);
    urls.push(
      `https://www.unil.ch/files/live/sites/fbm/files/06-espaces/sciences-infirmieres/${formatted}_${lowerName}.xlsx`
    );
    urls.push(
      `https://www.unil.ch/files/live/sites/fbm/files/06-espaces/sciences-infirmieres/${formatted}_${upperName}.xlsx`
    );
  }

  return urls;
}

export async function findMostRecentFileUrl(
  fileType: FileType
): Promise<{ url: string; lastModified: Date } | null> {
  const candidateUrls = generateFileUrls(fileType, 30);
  let best: { url: string; lastModified: Date } | null = null;

  for (const url of candidateUrls) {
    const response = await fetch(url, { method: "HEAD" });
    const lastModifiedHeader = response.headers.get("last-modified");

    if (response.ok && lastModifiedHeader) {
      const lastModified = new Date(lastModifiedHeader);
      if (!best || lastModified > best.lastModified) {
        best = { url, lastModified };
      }
    }
  }

  return best;
}

const CACHE_DURATION_MS = 6 * 60 * 60 * 1000;

type CacheEntry = { result: { url: string; lastModified: Date } | null; cachedAt: Date | null };

const cache: Record<FileType, CacheEntry> = {
  coursAutomne: { result: null, cachedAt: null },
  coursPrintemps: { result: null, cachedAt: null },
  examensAutomne: { result: null, cachedAt: null },
  examensPrintemps: { result: null, cachedAt: null },
};

export async function getFileUrl(fileType: FileType): Promise<string> {
  const now = Date.now();
  const entry = cache[fileType];

  if (entry.result && entry.cachedAt && now - entry.cachedAt.getTime() < CACHE_DURATION_MS) {
    return entry.result.url;
  }

  const result = await findMostRecentFileUrl(fileType);

  if (result) {
    entry.result = result;
    entry.cachedAt = new Date();
    return result.url;
  }

  if (entry.result) {
    return entry.result.url;
  }

  throw new Error(
    `Impossible de trouver l'URL du fichier (${fileType}) : aucune réponse valide et aucun cache disponible.`
  );
}
