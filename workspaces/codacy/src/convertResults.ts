import { readFileSync } from "node:fs"

import { FileError, Issue, ToolResult } from "codacy-seed"

import { patternIdToCodacy } from "lib/models/patterns.ts"

export interface BiomeDiagnostic {
  category: string
  severity: "error" | "warning" | "information" | "hint" | "fatal"
  description: string
  location: {
    path: { file?: string; argv?: string }
    span?: [number, number]
    sourceCode?: string
  }
  message: unknown[]
  tags: string[]
  source: null | object
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

function byteOffsetToLine(content: string, byteOffset: number): number {
  try {
    const buf = Buffer.from(content, "utf-8")
    const slice = buf.subarray(0, byteOffset).toString("utf-8")
    return slice.split("\n").length
  } catch {
    return 1
  }
}

const fileContentCache = new Map<string, string>()

function getFileContent(filePath: string): string {
  const cached = fileContentCache.get(filePath)
  if (cached !== undefined) return cached

  try {
    const content = readFileSync(filePath, "utf-8")
    fileContentCache.set(filePath, content)
    return content
  } catch {
    return ""
  }
}

export function convertResults(biomeOutput: BiomeOutput): ToolResult[] {
  const results: ToolResult[] = []

  for (const diagnostic of biomeOutput.diagnostics) {
    const filePath = diagnostic.location.path.file
    if (!filePath) continue

    if (diagnostic.severity === "fatal" || diagnostic.category === "parse") {
      results.push(new FileError(filePath, diagnostic.description))
      continue
    }

    const span = diagnostic.location.span
    let line = 1

    if (span) {
      const content = getFileContent(filePath)
      line = byteOffsetToLine(content, span[0])
    }

    const patternId = patternIdToCodacy(diagnostic.category)
    results.push(new Issue(filePath, diagnostic.description, patternId, line))
  }

  return results
}
