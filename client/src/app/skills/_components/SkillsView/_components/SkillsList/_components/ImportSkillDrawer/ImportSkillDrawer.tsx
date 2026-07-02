"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Drawer, FormField, Badge } from "@devdigest/ui";
import { useCreateSkill, useImportSkillPreview } from "@/lib/hooks/skills";
import { ApiError } from "@/lib/api";
import { fileToBase64 } from "./helpers";
import { ACCEPT, DRAWER_WIDTH } from "./constants";
import { s } from "./styles";

/** Import-skill drawer — file (.md/.zip) -> preview -> trust notice -> Save
    (as enabled:false). No DB write happens before Save. */
export function ImportSkillDrawer({ onClose }: { onClose: () => void }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const preview = useImportSkillPreview();
  const create = useCreateSkill();
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setErrorMessage(null);
    preview.reset();
    try {
      const content_base64 = await fileToBase64(file);
      preview.mutate(
        { filename: file.name, content_base64 },
        {
          onError: (err) => {
            setErrorMessage(err instanceof ApiError ? err.message : "Import failed");
          },
        },
      );
    } catch {
      setErrorMessage("Could not read the selected file.");
    }
  };

  const save = async () => {
    if (!preview.data) return;
    const skill = await create.mutateAsync({ ...preview.data, enabled: false });
    onClose();
    router.push(`/skills/${skill.id}?tab=config`);
  };

  const data = preview.data;

  return (
    <Drawer
      width={DRAWER_WIDTH}
      title={t("drawer.title")}
      subtitle={t("drawer.subtitle")}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <Button kind="ghost" onClick={onClose}>
            {t("create.cancel")}
          </Button>
          <Button kind="primary" icon="Check" onClick={save} disabled={!data || create.isPending}>
            {create.isPending ? t("file.importing") : t("preview.save")}
          </Button>
        </div>
      }
    >
      <div style={s.body}>
        <FormField label={t("file.uploadLabel")} hint={t("file.uploadHint")}>
          <div style={s.fileRow}>
            <Button kind="secondary" icon="File" onClick={() => document.getElementById("skill-file-input")?.click()}>
              {t("file.choose")}
            </Button>
            {fileName && <span style={s.fileName}>{fileName}</span>}
          </div>
          <input
            id="skill-file-input"
            type="file"
            accept={ACCEPT}
            onChange={onFileChange}
            style={{ display: "none" }}
          />
        </FormField>

        {preview.isPending && <div style={s.fileName}>{t("file.importing")}</div>}

        {errorMessage && (
          <div style={s.errorBox}>
            <strong>{t("drawer.importFailed")}</strong>: {errorMessage}
          </div>
        )}

        {data && (
          <div style={s.previewBox}>
            <div style={s.previewHeader}>
              <span style={s.previewName}>{data.name}</span>
              <Badge>{t(`listItem.type.${data.type}`)}</Badge>
            </div>
            <div style={s.bodyPreview} className="mono">
              {data.body}
            </div>

            {data.warnings.length > 0 && (
              <ul style={s.warningList}>
                {data.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}

            {data.ignored_files.length > 0 && (
              <div style={s.ignoredNote}>
                {t("drawer.ignoredFiles", {
                  count: data.ignored_files.length,
                  files: data.ignored_files.join(", "),
                })}
              </div>
            )}

            <div style={s.trustNotice}>{t("preview.untrustedNotice")}</div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
