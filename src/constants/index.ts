import pc from "picocolors";
import { Formatter } from "picocolors/types";
import { EditorChoice, Framework, Variant } from "../types/index.type";

export const frameworkList = ["Vue", "React", "Vanilla"] as const;
export const variantList = ["TypeScript", "JavaScript"] as const;
export const styleSchemeList = ["CSS", "SCSS"] as const;
export const enhancementList = ["Tailwind CSS v4.0", "Oxfmt", "Oxlint", "Pinia (Persisted)", "Env Config", "AI Ready"] as const;

export const variantMap: Record<Variant, string> = {
  TypeScript: "ts",
  JavaScript: "js",
};

export const styleSchemeMap: Record<string, string> = {
  CSS: "css",
  SCSS: "scss",
};

export const frameworkMap: Record<Framework, string> = {
  Vue: "vue",
  React: "react",
  Vanilla: "vanilla",
};

export const reverseFrameworkMap = Object.fromEntries(
  Object.entries(frameworkMap).map(([k, v]) => [v, k])
) as Record<string, Framework>;

export const frameworkIcon: Record<Framework, { icon: string; color: Formatter }> = {
  Vue: {
    icon: "🌿",
    color: pc.green,
  },
  React: {
    icon: "⚛️ ",
    color: pc.magenta,
  },
  Vanilla: {
    icon: "📜",
    color: pc.yellow,
  },
};

export const EDITORS: EditorChoice[] = [
  { title: "VS Code", value: "vscode", command: "code" },
  { title: "Cursor", value: "cursor", command: "cursor" },
  { title: "Kiro", value: "kiro", command: "kiro" },
  { title: "Trae", value: "trae", command: "trae" },
  { title: "WebStorm", value: "webstorm", command: "wstorm" },
  { title: "Other", value: "other", command: "" },
];
