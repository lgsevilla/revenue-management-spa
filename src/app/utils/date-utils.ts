export interface IsoWeek {
  weekYear: number; // ISO week-year (can differ near Jan 1)
  week: number;     // 1..53
}

export function getIsoWeek(dateIso: string): IsoWeek {
  // dateIso: "YYYY-MM-DD"
  const date = new Date(dateIso + "T00:00:00Z");

  // ISO week date weeks start on Monday, so correct day number
  const day = (date.getUTCDay() + 6) % 7; // Mon=0..Sun=6

  // Move date to Thursday in the current week to determine ISO week-year
  date.setUTCDate(date.getUTCDate() - day + 3);

  const weekYear = date.getUTCFullYear();

  // January 4th is always in week 1
  const jan4 = new Date(Date.UTC(weekYear, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
  const week1Thursday = new Date(jan4);
  week1Thursday.setUTCDate(jan4.getUTCDate() - jan4Day + 3);

  const diffMs = date.getTime() - week1Thursday.getTime();
  const week = 1 + Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));

  return { weekYear, week };
}

export function isoWeekLabel(dateIso: string): string {
  const { weekYear, week } = getIsoWeek(dateIso);
  return `${weekYear}-W${String(week).padStart(2, "0")}`;
}