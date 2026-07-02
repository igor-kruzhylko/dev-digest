import { SkillsListView } from "./_components/SkillsListView";

/* Route: /skills (Skills list). Thin route entry — the grid view, its
   create/import modals, styles, constants and i18n are colocated under
   _components/SkillsListView. Mirrors /agents' page.tsx. */
export default function SkillsPage() {
  return <SkillsListView />;
}
