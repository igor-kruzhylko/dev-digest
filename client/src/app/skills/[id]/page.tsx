"use client";

import { useParams } from "next/navigation";
import { SkillsView } from "../_components/SkillsView";

/* Route: /skills/:id (Skills list + selected skill detail). Same shared
   SkillsView as /skills — this route just supplies the selected id. */
export default function SkillDetailPage() {
  const params = useParams<{ id: string }>();
  return <SkillsView selectedId={params.id} />;
}
