/** Under 1 month or unknown = 1. From 1 month up to a year = 2. A year or more = 3. */
export function storyStrength(monthsLater: number | undefined): 1 | 2 | 3 {
  if (monthsLater == null || monthsLater < 1) return 1;
  if (monthsLater < 12) return 2;
  return 3;
}
