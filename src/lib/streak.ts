/** Streak rewards repeat every week: a milestone's `days` is its day within each 7-day week. */
export const STREAK_WEEK = 7;

/** Position of a streak within its current week, 1-7, or 0 with no streak. */
export function weekDay(streak: number) {
  return streak > 0 ? ((streak - 1) % STREAK_WEEK) + 1 : 0;
}

/** Check-ins still needed to land on the next reward day, given the reward days of the week. */
export function checkInsToNext(streak: number, rewardDays: number[]) {
  const done = weekDay(streak);
  const days = rewardDays.filter((d) => d >= 1 && d <= STREAK_WEEK).sort((a, b) => a - b);
  if (!days.length) return null;
  const later = days.find((d) => d > done);
  return later !== undefined ? { day: later, inDays: later - done } : { day: days[0], inDays: days[0] + STREAK_WEEK - done };
}
