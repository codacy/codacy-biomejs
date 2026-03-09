import { Category, Level, ScanType, SecuritySubcategory } from "codacy-seed"

export function translateTypes(
  patternId: string
): [Level, Category, SecuritySubcategory?, ScanType?] {
  const group = patternId.split("/")[1] ?? ""

  switch (group) {
    case "security":
      return ["Error", "Security", undefined, "SAST"]
    case "correctness":
      return ["Error", "ErrorProne"]
    case "suspicious":
      return ["Warning", "ErrorProne"]
    case "complexity":
      return ["Warning", "CodeStyle"]
    case "style":
      return ["Info", "CodeStyle"]
    case "performance":
      return ["Warning", "Performance"]
    case "a11y":
      return ["Warning", "Compatibility"]
    case "nursery":
      return ["Warning", "BestPractice"]
    default:
      return ["Warning", "BestPractice"]
  }
}

export function patternIdToCodacy(patternId: string): string {
  return patternId.replace(/\//g, "_")
}

export function patternIdToBiome(patternId: string): string {
  // "lint_suspicious_noDoubleEquals" → "lint/suspicious/noDoubleEquals"
  // Works because Biome rule names are camelCase (no underscores)
  const parts = patternId.split("_")
  if (parts.length >= 3) {
    return `${parts[0]}/${parts[1]}/${parts.slice(2).join("_")}`
  }
  return patternId
}
