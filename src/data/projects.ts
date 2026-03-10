import type { Lang } from "../i18n/translations";

export type ProjectCategory = "docker" | "web";

export const categoryLabels: Record<ProjectCategory, Record<Lang, string>> = {
  docker: { sk: "Docker Images", en: "Docker Images" },
  web: { sk: "Web", en: "Web" },
};

export const categories: ProjectCategory[] = ["docker", "web"];
