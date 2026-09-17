/** Formats an ISO date string for display, or null when the date is missing or unparseable. */
export function formatDate(date: string | undefined): string | null {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(parsed);
}
