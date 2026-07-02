"use client";

import { useTranslations } from "next-intl";
import { s } from "./styles";

/** Evals tab — placeholder. The eval pipeline is deferred to a future lesson;
    no functionality, no data fetching. */
export function EvalsTab() {
  const t = useTranslations("skills");
  return <div style={s.wrap}>{t("tabs.evalsPlaceholder")}</div>;
}
