// Problems the learner reports on an exercise, with everything around it, so
// they reach the developer through the backup file (Settings > Backup).
const REPORTS_KEY = "fr-en-translate:reports";
const MAX_REPORTS = 200;

export type Report = {
  at: string;
  note: string;
  // The exercise, the learner's answer and the correction as the page had them.
  exercise: unknown;
  answer?: string;
  correction?: unknown;
  // The error shown on the page, if any.
  error?: string;
  settings: unknown;
};

function readReports(): Report[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(REPORTS_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as Report[]) : [];
  } catch {
    return [];
  }
}

// Saves a report; false if the browser refused it.
export function rememberReport(report: Omit<Report, "at">) {
  try {
    const reports = [...readReports(), { ...report, at: new Date().toISOString() }];
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports.slice(-MAX_REPORTS)));
    return true;
  } catch {
    return false;
  }
}
