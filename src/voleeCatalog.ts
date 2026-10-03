export type FiliereId = "ICLS" | "IPS" | "MScIPS" | "MScSI";
export const FILIERES: readonly FiliereId[] = ["ICLS", "IPS", "MScIPS", "MScSI"];

export type ModaliteId = "tempsPlein" | "tempsPartiel" | "tempsPartiel6" | "tempsPartiel8";
export const MODALITES: readonly ModaliteId[] = ["tempsPlein", "tempsPartiel", "tempsPartiel6", "tempsPartiel8"];

export type OptionId =
  | "santeMentale"
  | "soinsAdultes"
  | "soinsPrimaires"
  | "soinsPediatriques"
  | "optionClinique"
  | "optionRecherche";

export const OPTION_LABELS: Record<OptionId, string> = {
  santeMentale: "Santé mentale",
  soinsAdultes: "Soins aux adultes",
  soinsPrimaires: "Soins primaires",
  soinsPediatriques: "Soins pédiatriques",
  optionClinique: "Option clinique",
  optionRecherche: "Option recherche",
};

export const OPTIONS: readonly OptionId[] = [
  "santeMentale",
  "soinsAdultes",
  "soinsPrimaires",
  "soinsPediatriques",
  "optionClinique",
  "optionRecherche",
];

export const MODALITE_LABELS: Record<ModaliteId, string> = {
  tempsPlein: "Temps plein",
  tempsPartiel: "Temps partiel",
  tempsPartiel6: "Temps partiel 6 semestres",
  tempsPartiel8: "Temps partiel 8 semestres",
};

export const OPTIONS_BY_FILIERE: Record<FiliereId, OptionId[]> = {
  IPS: ["santeMentale", "soinsAdultes", "soinsPrimaires", "soinsPediatriques"],
  ICLS: ["optionClinique", "optionRecherche"],
  MScIPS: [],
  MScSI: [],
};

const OPTION_KEYWORDS: Record<OptionId, string[]> = {
  santeMentale: ["mentale"],
  soinsAdultes: ["adulte"],
  soinsPrimaires: ["primaire"],
  soinsPediatriques: ["pédiatr", "pediatr", "enfant"],
  optionClinique: ["clinique"],
  optionRecherche: ["recherche"],
};

export interface Volee {
  filiere: FiliereId;
  annee: number;
}

export interface VoleeRef {
  filiere: FiliereId;
  annee: number | null;
}

export function voleeKey(volee: Volee): string {
  return `${volee.filiere} ${volee.annee}`;
}

export function parseVoleeKey(raw: string): Volee | null {
  const match = raw.trim().match(/^(\S+)\s+(\d{4})$/);
  if (!match) return null;
  const [, filiereRaw, anneeRaw] = match;
  const filiere = FILIERES.find((f) => f.toLowerCase() === (filiereRaw ?? "").toLowerCase());
  if (!filiere || !anneeRaw) return null;
  return { filiere, annee: Number(anneeRaw) };
}

interface ModaliteParseResult {
  modalites: ModaliteId[];
  explicit: ModaliteId[];
}

function parseModaliteText(rawText: string, context: string): ModaliteParseResult {
  const text = rawText.trim();
  const lower = text.toLowerCase();

  if (!text) {
    return { modalites: [...MODALITES], explicit: [] };
  }

  if (lower.includes("tous")) {
    if (lower.includes("partiel")) {
      return { modalites: ["tempsPartiel", "tempsPartiel6", "tempsPartiel8"], explicit: [] };
    }
    return { modalites: [...MODALITES], explicit: [] };
  }

  if (/6\s*semestres?/.test(lower)) {
    return { modalites: ["tempsPartiel6"], explicit: ["tempsPartiel6"] };
  }
  if (/8\s*semestres?/.test(lower)) {
    return { modalites: ["tempsPartiel8"], explicit: ["tempsPartiel8"] };
  }
  if (lower.includes("partiel")) {
    return { modalites: ["tempsPartiel"], explicit: ["tempsPartiel"] };
  }
  if (lower.includes("plein")) {
    return { modalites: ["tempsPlein"], explicit: ["tempsPlein"] };
  }

  console.warn(
    `[voleeCatalog] Libellé de modalité non reconnu : "${text}" (${context}) — toutes les modalités retenues par défaut.`
  );
  return { modalites: [...MODALITES], explicit: [] };
}

function normalizeFiliere(raw: string): FiliereId {
  const found = FILIERES.find((f) => f.toLowerCase() === raw.toLowerCase());
  return found ?? (raw.toUpperCase() as FiliereId);
}

interface ParsedSegment {
  volee: VoleeRef | null;
  modalites: ModaliteId[];
  modalitesExplicit: ModaliteId[];
}

function parseSegment(rawSegment: string, context: string): ParsedSegment {
  const text = rawSegment
    .replace(/(?<!\p{L})(?:Volée|Volee)(?!\p{L})/giu, " ")
    .replace(/(?<!\p{L})[ÉE]tudiants(?!\p{L})/giu, " ");

  const filiereMatch = text.match(/\b(MScIPS|MScSI|ICLS|IPS)\b/i);
  if (!filiereMatch || filiereMatch.index === undefined) {
    console.warn(`[voleeCatalog] Filière non reconnue dans le segment "${rawSegment}" (${context}).`);
    const { modalites, explicit } = parseModaliteText(text, context);
    return { volee: null, modalites, modalitesExplicit: explicit };
  }

  const filiere = normalizeFiliere(filiereMatch[0]);
  const before = text.slice(0, filiereMatch.index);
  const afterText = text.slice(filiereMatch.index + filiereMatch[0].length);

  const anneeMatch = afterText.match(/^\s*(\d{4})\b/);
  const oldFormatMatch = !anneeMatch ? afterText.match(/^\s*(\d+)-(\d{2})\b/) : null;

  let annee: number | null = null;
  let remainderAfter = afterText;

  if (anneeMatch) {
    annee = Number(anneeMatch[1]);
    remainderAfter = afterText.slice(anneeMatch[0].length);
  } else if (oldFormatMatch) {
    annee = 2000 + Number(oldFormatMatch[2]);
    remainderAfter = afterText.slice(oldFormatMatch[0].length);
  }

  const modaliteText = `${before} ${remainderAfter}`.replace(/\s+/g, " ").trim();
  const { modalites, explicit } = parseModaliteText(modaliteText, context);

  return {
    volee: { filiere, annee },
    modalites,
    modalitesExplicit: explicit,
  };
}

export function parseVoleeCell(rawVolee: string, context = rawVolee): ParsedSegment[] {
  if (!rawVolee) return [];
  return rawVolee.split("/").map((segment) => parseSegment(segment.trim(), context));
}

export interface OptionParseResult {
  options: OptionId[];
  explicit: OptionId[];
}

export function parseOptionCell(rawOption: string, context = rawOption): OptionParseResult {
  const text = rawOption.trim();
  const lower = text.toLowerCase();

  if (!text || lower.includes("tous") || lower.includes("toutes orientations")) {
    return { options: [...OPTIONS], explicit: [] };
  }

  const parts = text
    .split(/[/,]/)
    .map((p) => p.trim())
    .filter(Boolean);

  const found: OptionId[] = [];

  for (const part of parts) {
    const lowerPart = part.toLowerCase();
    const matchedId = OPTIONS.find((id) => OPTION_KEYWORDS[id].some((kw) => lowerPart.includes(kw)));
    if (!matchedId) {
      console.warn(
        `[voleeCatalog] Partie d'option non reconnue : "${part}" (${context}) — toutes les options retenues par défaut.`
      );
      return { options: [...OPTIONS], explicit: [] };
    }
    if (!found.includes(matchedId)) {
      found.push(matchedId);
    }
  }

  return { options: found, explicit: found };
}

export function courseMatches(
  course: { volee: string; option: string },
  volee: Volee,
  modaliteId?: ModaliteId,
  optionId?: OptionId
): boolean {
  const segments = parseVoleeCell(course.volee);
  const matchingSegments = segments.filter((seg) => {
    if (!seg.volee) return false;
    const sameFiliere = seg.volee.filiere === volee.filiere;
    const sameAnnee = seg.volee.annee === null || seg.volee.annee === volee.annee;
    return sameFiliere && sameAnnee;
  });

  if (matchingSegments.length === 0) return false;

  if (modaliteId && !matchingSegments.some((seg) => seg.modalites.includes(modaliteId))) {
    return false;
  }

  if (optionId) {
    const filiereOptions = OPTIONS_BY_FILIERE[volee.filiere];
    const { options } = parseOptionCell(course.option);
    const relevantOptions = options.filter((o) => filiereOptions.includes(o));
    if (relevantOptions.length > 0 && !relevantOptions.includes(optionId)) {
      return false;
    }
  }

  return true;
}

export interface VoleeInfo {
  volee: Volee;
  modalites: ModaliteId[];
  options: OptionId[];
}

export function buildVoleeCatalog(courses: { volee: string; option: string }[]): VoleeInfo[] {
  const keys: string[] = [];
  const volees = new Map<string, Volee>();
  const modalitesByKey = new Map<string, Set<ModaliteId>>();
  const optionsByKey = new Map<string, Set<OptionId>>();

  for (const course of courses) {
    const segments = parseVoleeCell(course.volee);
    const optionResult = parseOptionCell(course.option);

    for (const seg of segments) {
      if (!seg.volee || seg.volee.annee === null) continue;

      const concreteVolee: Volee = { filiere: seg.volee.filiere, annee: seg.volee.annee };
      const key = voleeKey(concreteVolee);

      if (!volees.has(key)) {
        volees.set(key, concreteVolee);
        modalitesByKey.set(key, new Set());
        optionsByKey.set(key, new Set());
        keys.push(key);
      }

      for (const m of seg.modalitesExplicit) {
        modalitesByKey.get(key)!.add(m);
      }

      const filiereOptions = OPTIONS_BY_FILIERE[concreteVolee.filiere];
      for (const o of optionResult.explicit) {
        if (filiereOptions.includes(o)) {
          optionsByKey.get(key)!.add(o);
        }
      }
    }
  }

  keys.sort((a, b) => {
    const va = volees.get(a)!;
    const vb = volees.get(b)!;
    if (va.filiere !== vb.filiere) return va.filiere.localeCompare(vb.filiere);
    return va.annee - vb.annee;
  });

  return keys.map((key) => {
    const volee = volees.get(key)!;
    return {
      volee,
      modalites: MODALITES.filter((m) => modalitesByKey.get(key)!.has(m)),
      options: OPTIONS.filter((o) => optionsByKey.get(key)!.has(o)),
    };
  });
}
