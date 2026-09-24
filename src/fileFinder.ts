function formatDateYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function generateCoursAutomneUrls(daysBack: number): string[] {
  const urls: string[] = [];
  const today = new Date();

  for (let i = 0; i <= daysBack; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const formatted = formatDateYYYYMMDD(date);
    urls.push(
      `https://www.unil.ch/files/live/sites/fbm/files/06-espaces/sciences-infirmieres/${formatted}_horaire_automne_2026.xlsx`
    );
    urls.push(
      `https://www.unil.ch/files/live/sites/fbm/files/06-espaces/sciences-infirmieres/${formatted}_Horaire_Automne_2026.xlsx`
    );
  }

  return urls;
}
