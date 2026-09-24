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

export function matchesVolee(rawVolee: string, selectedVolee: string): boolean {
  const selectedLower = selectedVolee.toLowerCase();
  const segments = rawVolee.split("/").map((part) => cleanVoleePart(part).toLowerCase());

  for (const segment of segments) {
    if (!segment) continue;
    if (segment === selectedLower) {
      return true;
    }
    const hasDigit = /\d/.test(segment);
    if (!hasDigit && selectedLower.startsWith(segment)) {
      const nextChar = selectedLower[segment.length];
      const isBoundary = nextChar === undefined || !/[a-z0-9]/.test(nextChar);
      if (isBoundary) {
        return true;
      }
    }
  }

  return false;
}
