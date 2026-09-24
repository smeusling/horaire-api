function formatDateYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function generateCoursAutomneUrls(daysBack: number): string[] {
  const urls: string[] = [];
  const today = new Date();
  const currentYear = new Date().getFullYear();

  for (let i = 0; i <= daysBack; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const formatted = formatDateYYYYMMDD(date);
    urls.push(
      `https://www.unil.ch/files/live/sites/fbm/files/06-espaces/sciences-infirmieres/${formatted}_horaire_automne_${currentYear}.xlsx`
    );
    urls.push(
      `https://www.unil.ch/files/live/sites/fbm/files/06-espaces/sciences-infirmieres/${formatted}_Horaire_Automne_${currentYear}.xlsx`
    );
  }

  return urls;
}

export async function findMostRecentCoursAutomneUrl(): Promise<{ url: string; lastModified: Date } | null> {
  const candidateUrls = generateCoursAutomneUrls(30);
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

let cachedResult: { url: string; lastModified: Date } | null = null;
let cachedAt: Date | null = null;

export async function getCoursAutomneUrl(): Promise<string> {
  const now = Date.now();

  if (cachedResult && cachedAt && now - cachedAt.getTime() < CACHE_DURATION_MS) {
    return cachedResult.url;
  }

  const result = await findMostRecentCoursAutomneUrl();

  if (result) {
    cachedResult = result;
    cachedAt = new Date();
    return result.url;
  }

  if (cachedResult) {
    return cachedResult.url;
  }

  throw new Error("Impossible de trouver l'URL du fichier des cours (aucune réponse valide et aucun cache disponible).");
}
