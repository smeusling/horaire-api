import type { FileType } from "./fileFinder.js";

export const HORAIRES_PAGE_URL =
  "https://www.unil.ch/fbm/fr/home/ressources/espaces/espace-interne-iufrs.html";

const FETCH_TIMEOUT_MS = 10_000;

export async function fetchHorairesPage(): Promise<string> {
  const response = await fetch(HORAIRES_PAGE_URL, {
    headers: {
      "User-Agent": "HorairesCoursAPI/1.0 (https://github.com/smeusling/horaire-api)",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (response.status !== 200) {
    throw new Error(
      `Impossible de récupérer la page des horaires (${HORAIRES_PAGE_URL}) : statut HTTP ${response.status}.`
    );
  }

  return response.text();
}

export interface XlsxLink {
  url: string;
  text: string;
  fileName: string;
}

const ANCHOR_PATTERN = /<a\b([^>]*)>(.*?)<\/a>/gis;
const HREF_PATTERN = /href\s*=\s*(?:"([^"]*)"|'([^']*)')/i;

function decodeHtmlText(text: string): string {
  return text.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&");
}

export function extractXlsxLinks(html: string, pageUrl: string): XlsxLink[] {
  const links: XlsxLink[] = [];

  for (const match of html.matchAll(ANCHOR_PATTERN)) {
    const attributes = match[1] ?? "";
    const rawText = match[2] ?? "";

    const hrefMatch = HREF_PATTERN.exec(attributes);
    const href = hrefMatch?.[1] ?? hrefMatch?.[2];
    if (!href) continue;

    let url: URL;
    try {
      url = new URL(href, pageUrl);
    } catch {
      continue;
    }

    if (!url.pathname.toLowerCase().endsWith(".xlsx")) continue;

    const fileName = url.pathname.substring(url.pathname.lastIndexOf("/") + 1);
    const text = decodeHtmlText(rawText).trim();

    links.push({ url: url.toString(), text, fileName });
  }

  return links;
}

function buildExpectedFileNameFragment(fileType: FileType, year: number): string {
  switch (fileType) {
    case "coursAutomne":
      return `horaire_automne_${year}`;
    case "coursPrintemps":
      return `horaire_printemps_${year}`;
    case "examensAutomne":
      return `horaire_examens_a${String(year).slice(-2)}`;
    case "examensPrintemps":
      return `horaire_examens_p${String(year).slice(-2)}`;
  }
}

export function findLinksForFileType(
  links: XlsxLink[],
  fileType: FileType,
  year: number
): XlsxLink[] {
  const fragment = buildExpectedFileNameFragment(fileType, year);
  const matches = links.filter((link) => link.fileName.toLowerCase().includes(fragment));

  const seenUrls = new Set<string>();
  const deduplicated: XlsxLink[] = [];
  for (const link of matches) {
    if (seenUrls.has(link.url)) continue;
    seenUrls.add(link.url);
    deduplicated.push(link);
  }

  return deduplicated;
}
