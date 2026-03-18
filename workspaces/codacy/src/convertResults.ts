import { FileError, Issue, ToolResult } from "codacy-seed"

import { patternIdToCodacy } from "lib/models/patterns.ts"

export interface BiomeDiagnostic {
  category: string
  severity: "error" | "warning" | "information" | "hint" | "fatal"
  message: string
  location: {
    path: string
    start: { line: number; column: number }
    end: { line: number; column: number }
  }
}

export interface BiomeOutput {
  diagnostics: BiomeDiagnostic[]
  summary: {
    errors: number
    warnings: number
    changed: number
    unchanged: number
    skipped: number
    suggestedFixes: number
    diagnosticsNotPrinted: number
  }
  command: string
}

export function convertResults(biomeOutput: BiomeOutput): ToolResult[] {
  const results: ToolResult[] = []

  for (const diagnostic of biomeOutput.diagnostics) {
    const filePath = diagnostic.location.path
    if (!filePath) continue

    if (diagnostic.severity === "fatal" || diagnostic.category.startsWith("parse")) {
      results.push(new FileError(filePath, diagnostic.message))
      continue
    }

    const line = diagnostic.location.start?.line || 1

    const patternId = patternIdToCodacy(diagnostic.category)
    
    results.push(new Issue(
      filePath, 
      diagnostic.message,
      patternId, 
      line
    ))
  }

  return results
}