export const BIOME_GROUPS = [
  "a11y",
  "complexity",
  "correctness",
  "nursery",
  "performance",
  "security",
  "style",
  "suspicious",
] as const

export type BiomeGroup = (typeof BIOME_GROUPS)[number]

export interface BiomeRule {
  ruleId: string       // e.g. "lint/suspicious/noDoubleEquals"
  group: BiomeGroup    // e.g. "suspicious"
  name: string         // e.g. "noDoubleEquals"
  recommended: boolean
  description: string
}

export function getRuleGroup(ruleId: string): string {
  return ruleId.split("/")[1] ?? ""
}

export function getRuleName(ruleId: string): string {
  return ruleId.split("/")[2] ?? ""
}

// Convert camelCase rule name to kebab-case for doc file names
// e.g. "noDoubleEquals" → "no-double-equals"
export function ruleNameToDocFileName(ruleName: string): string {
  return ruleName.replace(/([A-Z])/g, "-$1").toLowerCase()
}
