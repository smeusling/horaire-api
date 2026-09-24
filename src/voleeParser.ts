interface CoursVolee {
  volee: string;
}

const NOISE_PATTERN = /(temps\s+plein|temps\s+partiel|partiel|plein|tous|\(?\s*[68]\s+semestres\s*\)?)/gi;
const ALLOWED_PREFIXES = ["icls", "ips", "mscips", "etudiants"];

export function cleanVoleePart(part: string): string {
  return part
    .replace(NOISE_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractVolees(courses: CoursVolee[]): string[] {
  const volees = new Set<string>();

  for (const course of courses) {
    if (!course.volee) continue;
    const parts = course.volee.split("/");
    for (const rawPart of parts) {
      const cleaned = cleanVoleePart(rawPart);
      const lower = cleaned.toLowerCase();
      const matchesPrefix = ALLOWED_PREFIXES.some((prefix) => lower.startsWith(prefix));
      if (matchesPrefix && cleaned.length >= 3) {
        volees.add(cleaned);
      }
    }
  }

  return Array.from(volees).sort((a, b) => a.localeCompare(b));
}

function findMatchingRawSegment(rawVolee: string, selectedVolee: string): string | undefined {
  const selectedLower = selectedVolee.toLowerCase();
  const rawSegments = rawVolee.split("/");

  for (const rawSegment of rawSegments) {
    const cleaned = cleanVoleePart(rawSegment).toLowerCase();
    if (!cleaned) continue;
    if (cleaned === selectedLower) {
      return rawSegment;
    }
    const hasDigit = /\d/.test(cleaned);
    if (!hasDigit && selectedLower.startsWith(cleaned)) {
      const nextChar = selectedLower[cleaned.length];
      const isBoundary = nextChar === undefined || !/[a-z0-9]/.test(nextChar);
      if (isBoundary) {
        return rawSegment;
      }
    }
  }

  return undefined;
}

export function matchesVolee(rawVolee: string, selectedVolee: string): boolean {
  return findMatchingRawSegment(rawVolee, selectedVolee) !== undefined;
}

export function matchesModalite(
  rawVolee: string,
  selectedVolee: string,
  selectedModalites: string[]
): boolean {
  const rawSegment = findMatchingRawSegment(rawVolee, selectedVolee);
  if (rawSegment === undefined) {
    return false;
  }

  if (selectedModalites.includes("tempsPlein") && selectedModalites.includes("partiel")) {
    return true;
  }

  const rawSegmentLower = rawSegment.toLowerCase();
  if (rawSegmentLower.includes("tous")) {
    return true;
  }

  if (selectedModalites.includes("tempsPlein") && rawSegmentLower.includes("plein")) {
    return true;
  }
  if (selectedModalites.includes("partiel") && rawSegmentLower.includes("partiel")) {
    return true;
  }

  return false;
}

export function matchesOption(courseOption: string, selectedOption: string): boolean {
  const cleanOption = courseOption.trim();
  const lowerClean = cleanOption.toLowerCase();

  if (!cleanOption || lowerClean.includes("tous") || lowerClean.includes("toutes orientations")) {
    return true;
  }

  const selectedLower = selectedOption.toLowerCase();
  const parts = cleanOption.split(/[/,]/).map((part) => part.trim());

  return parts.some((part) => {
    if (!part) return false;
    const lowerPart = part.toLowerCase();
    if (lowerPart === selectedLower || selectedLower.includes(lowerPart) || lowerPart.includes(selectedLower)) {
      return true;
    }
    if (selectedLower.includes("primaire") && (lowerPart === "primaires" || lowerPart.includes("primaire"))) {
      return true;
    }
    if (selectedLower.includes("adulte") && (lowerPart === "adultes" || lowerPart.includes("adulte"))) {
      return true;
    }
    if (
      selectedLower.includes("enfant") &&
      (lowerPart === "pédiatriques" ||
        lowerPart === "pediatriques" ||
        lowerPart === "pédiatrie" ||
        lowerPart === "pediatrie" ||
        lowerPart.includes("enfant"))
    ) {
      return true;
    }
    if (selectedLower.includes("mentale") && lowerPart.includes("mentale")) {
      return true;
    }
    return false;
  });
}

interface FilterableCourse {
  volee: string;
  option: string;
  date?: string;
  heureDebut?: string;
}

export function filterCourses<T extends FilterableCourse>(
  courses: T[],
  selectedVolee: string,
  selectedModalites: string[],
  selectedOption?: string
): T[] {
  const filtered = courses.filter((course) => {
    if (!matchesVolee(course.volee, selectedVolee)) return false;
    if (!matchesModalite(course.volee, selectedVolee, selectedModalites)) return false;
    if (selectedOption && !matchesOption(course.option, selectedOption)) return false;
    return true;
  });

  return filtered.sort((a, b) => {
    const dateA = a.date ?? "";
    const dateB = b.date ?? "";
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    const heureA = a.heureDebut ?? "";
    const heureB = b.heureDebut ?? "";
    return heureA.localeCompare(heureB);
  });
}
