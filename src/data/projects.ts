import type { Lang } from "../i18n/translations";

export type ProjectCategory = "docker" | "web" | "monitoring";

export const categoryLabels: Record<ProjectCategory, Record<Lang, string>> = {
  docker: { sk: "Docker Images", en: "Docker Images" },
  web: { sk: "Web", en: "Web" },
  monitoring: { sk: "Monitoring", en: "Monitoring" },
};

export const categories: ProjectCategory[] = ["docker", "web", "monitoring"];
