import { enhancementList, frameworkList, styleSchemeList, variantList } from "../constants";

export type Framework = (typeof frameworkList)[number];
export type Variant = (typeof variantList)[number];
export type StyleScheme = (typeof styleSchemeList)[number];
export type Enhancement = (typeof enhancementList)[number];

export interface CreateCommandOption {
  framework: Framework;
  variant: Variant;
  styleScheme: StyleScheme;
  remote: string;
}

export type EditorChoice = {
  title: string;
  value: string;
  command: string;
};
