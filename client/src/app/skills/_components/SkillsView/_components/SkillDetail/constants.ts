import type { IconName } from "@devdigest/ui";

/** Detail tab descriptor. `labelKey` resolves under the `skills` namespace. */
export interface DetailTab {
  key: string;
  labelKey: string;
  icon: IconName;
}

export const TABS: readonly DetailTab[] = [
  { key: "config", labelKey: "tabs.config", icon: "Settings" },
  { key: "preview", labelKey: "tabs.preview", icon: "Eye" },
  { key: "evals", labelKey: "tabs.evals", icon: "FlaskConical" },
  { key: "stats", labelKey: "tabs.stats", icon: "Gauge" },
  { key: "versions", labelKey: "tabs.versions", icon: "History" },
];

export const VALID_TABS: readonly string[] = TABS.map((tb) => tb.key);
export const DEFAULT_TAB = "config";
