import { SkillsView } from "./_components/SkillsView";

/* Route: /skills (Skills list, nothing selected). Thin route entry — the
   master-detail view, its tabs, styles, constants and i18n are colocated
   under _components/SkillsView. */
export default function SkillsPage() {
  return <SkillsView selectedId={null} />;
}
