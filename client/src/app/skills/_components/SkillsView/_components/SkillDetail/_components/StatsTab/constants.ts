/** Stat cards with no data source yet — rendered as "not tracked yet", never
    fabricated numbers (spec §7.2 / §14). Keyed by their i18n label key under
    the `skills.stats` namespace. */
export const UNTRACKED_CARD_KEYS: readonly string[] = [
  "pullFrequency",
  "acceptRate",
  "findings30d",
  "cost",
];
