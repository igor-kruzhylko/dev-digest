/* hooks/skills.ts - React Query hooks for the Skills Lab (list/detail/CRUD +
   versions + usage + import preview). Mirrors hooks/agents.ts's shape. */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type {
  Skill,
  CreateSkillInput as CreateSkillBody,
  UpdateSkillInput as UpdateSkillBody,
  SkillVersion,
  SkillUsage,
  SkillImportPreview,
  ImportSkillInput,
} from "@devdigest/shared";

export type CreateSkillInput = CreateSkillBody;

export function useSkills() {
  return useQuery({
    queryKey: ["skills"],
    queryFn: () => api.get<Skill[]>("/skills"),
  });
}

export function useSkill(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill", id],
    queryFn: () => api.get<Skill>(`/skills/${id}`),
    enabled: !!id,
  });
}

export function useCreateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSkillInput) => api.post<Skill>("/skills", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skills"] }),
  });
}

export interface UpdateSkillInput {
  id: string;
  patch: UpdateSkillBody;
}

export function useUpdateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: UpdateSkillInput) => api.put<Skill>(`/skills/${id}`, patch),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.setQueryData(["skill", data.id], data);
    },
  });
}

/** Delete a skill. Can 409 (`skill_in_use`) — the caller (SkillCard / detail
    header) catches the ApiError and shows the linking agents (FR-8). */
export function useDeleteSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: boolean }>(`/skills/${id}`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.removeQueries({ queryKey: ["skill", id] });
    },
  });
}

/** Preview an import (no DB write) — not a query, it's a one-shot action. */
export function useImportSkillPreview() {
  return useMutation({
    mutationFn: (input: ImportSkillInput) =>
      api.post<SkillImportPreview>("/skills/import/preview", input),
  });
}

export function useSkillVersions(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill-versions", id],
    queryFn: () => api.get<SkillVersion[]>(`/skills/${id}/versions`),
    enabled: !!id,
  });
}

export function useSkillUsage(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill-usage", id],
    queryFn: () => api.get<SkillUsage>(`/skills/${id}/usage`),
    enabled: !!id,
  });
}

/** All-skills usage counts — powers the list card "{n} agents" stat. */
export function useSkillsUsage() {
  return useQuery({
    queryKey: ["skills-usage"],
    queryFn: () => api.get<SkillUsage[]>("/skills/usage"),
  });
}
