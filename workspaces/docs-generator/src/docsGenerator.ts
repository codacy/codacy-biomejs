import { EOL } from "node:os"
import path from "node:path"

import axios from "axios"
import {
  DescriptionEntry,
  PatternSpec,
  Specification,
  writeFile
} from "codacy-seed"
import fs from "fs-extra"

import { isBlacklistedOnlyFromDocumentation } from "lib/models/blacklist.ts"
import { type BiomeGroup, BIOME_GROUPS } from "lib/models/biomeRules.ts"
import { patternIdToCodacy, translateTypes } from "lib/models/patterns.ts"
import { capitalize, patternTitle } from "lib/utils/strings.ts"
import { toolName, toolVersion } from "lib/utils/metadata.ts"
import { TerminalColor, wrapConsoleTextInColor } from "lib/utils/logging.ts"

const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/biomejs/website/main"
const GITHUB_API_BASE = "https://api.github.com/repos/biomejs/website"
const BIOME_RULES_DOCS_PATH = "src/content/docs/linter/rules"

interface RuleDoc {
  ruleId: string       // "lint/suspicious/noDoubleEquals"
  group: BiomeGroup
  name: string         // "noDoubleEquals"
  description: string
  recommended: boolean
  docFileName: string  // "no-double-equals.mdx"
}

export class DocsGenerator {
  private docsDirectory = "./docs"
  private docsDescriptionDirectory = path.join(this.docsDirectory, "description")
  private rulesPromise: Promise<RuleDoc[]>

  constructor() {
    this.rulesPromise = this.fetchAllRules()
  }

  private async fetchAllRules(): Promise<RuleDoc[]> {
    try {
      // List all MDX files in the Biome rules docs directory
      const response = await axios.get<Array<{ name: string; type: string }>>(
        `${GITHUB_API_BASE}/contents/${BIOME_RULES_DOCS_PATH}`,
        { headers: { Accept: "application/vnd.github.v3+json" } }
      )

      const mdxFiles = response.data
        .filter((f) => f.type === "file" && f.name.endsWith(".mdx"))
        .map((f) => f.name)

      console.log(`Found ${mdxFiles.length} rule doc files`)

      const rules = await Promise.all(
        mdxFiles.map((fileName) => this.parseRuleDoc(fileName))
      )

      const validRules = rules.filter((r): r is RuleDoc => r !== null)
      console.log(`Loaded ${validRules.length} valid Biome rules`)
      return validRules
    } catch (error) {
      console.error("Failed to fetch Biome rule list:", error)
      return []
    }
  }

  private async parseRuleDoc(fileName: string): Promise<RuleDoc | null> {
    const url = `${GITHUB_RAW_BASE}/${BIOME_RULES_DOCS_PATH}/${fileName}`
    try {
      const response = await axios.get<string>(url)
      const content = response.data

      // Extract Diagnostic Category from content
      // Pattern: - Diagnostic Category: [`lint/suspicious/noDoubleEquals`](...)
      const categoryMatch = content.match(/Diagnostic Category: \[`(lint\/([^/]+)\/([^`]+))`\]/)
      if (!categoryMatch) return null

      const ruleId = categoryMatch[1]  // "lint/suspicious/noDoubleEquals"
      const group = categoryMatch[2] as BiomeGroup  // "suspicious"
      const name = categoryMatch[3]  // "noDoubleEquals"

      if (!BIOME_GROUPS.includes(group)) return null

      // Determine recommended status
      const recommended = content.includes("This rule is **recommended**")

      // Extract description - find the first descriptive paragraph
      const description = this.extractDescription(content)

      return {
        ruleId,
        group,
        name,
        description,
        recommended,
        docFileName: fileName,
      }
    } catch {
      console.error(wrapConsoleTextInColor(`Failed to parse rule doc: ${fileName}`, TerminalColor.Yellow))
      return null
    }
  }

  private extractDescription(content: string): string {
    // Find the ## Description section
    const descMatch = content.match(/## Description\n+([\s\S]*?)(?:\n## |\n<|$)/)
    if (descMatch) {
      // Take the first non-empty paragraph
      const paragraphs = descMatch[1].split(/\n{2,}/)
      for (const para of paragraphs) {
        const text = para.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim()
        if (text.length > 0 && !text.startsWith("<") && !text.startsWith("```")) {
          return text.replace(/\n/g, " ").trim()
        }
      }
    }

    // Fallback: use the frontmatter description field
    const frontmatterDesc = content.match(/^description:\s*(.+)$/m)
    if (frontmatterDesc) return frontmatterDesc[1].trim()

    return `Biome lint rule`
  }

  async createDescriptionFile(): Promise<void> {
    console.log("Generate description.json")
    const rules = await this.rulesPromise
    const descriptions: DescriptionEntry[] = rules
      .filter((r) => !isBlacklistedOnlyFromDocumentation(r.ruleId))
      .map((rule) => {
        return new DescriptionEntry(
          patternIdToCodacy(rule.ruleId),
          patternTitle(rule.ruleId),
          capitalize(rule.description),
          5,
          []
        )
      })

    if (!descriptions.length) return

    await this.emptyDocsDescriptionFolder()
    await this.writeFileInJson(
      path.resolve(this.docsDescriptionDirectory, "description.json"),
      descriptions
    )
    console.log(`Generated ${descriptions.length} description entries`)
  }

  async createPatternsFile(): Promise<void> {
    console.log("Generate patterns.json")
    const rules = await this.rulesPromise
    const patterns: PatternSpec[] = rules
      .filter((r) => !isBlacklistedOnlyFromDocumentation(r.ruleId))
      .map((rule) => {
        const [level, category, securitySubcategory, scanType] = translateTypes(rule.ruleId)
        return new PatternSpec(
          patternIdToCodacy(rule.ruleId),
          level,
          category,
          securitySubcategory,
          scanType,
          [],
          rule.recommended
        )
      })

    if (!patterns.length) return

    const specification = new Specification(toolName, toolVersion, patterns)
    await this.writeFileInJson(
      path.resolve(this.docsDirectory, "patterns.json"),
      specification
    )
    console.log(`Generated ${patterns.length} patterns`)
  }

  async createAllPatternsMultipleTestFiles(): Promise<void> {
    console.log("Generate patterns.xml (skipped — no all-patterns test directory)")
  }

  async downloadRuleDocs(): Promise<void> {
    const rules = await this.rulesPromise
    console.log(`Downloading ${rules.length} rule description files`)

    await Promise.all(
      rules
        .filter((r) => !isBlacklistedOnlyFromDocumentation(r.ruleId))
        .map((rule) => this.downloadRuleDoc(rule))
    )
  }

  private async downloadRuleDoc(rule: RuleDoc): Promise<void> {
    const url = `${GITHUB_RAW_BASE}/${BIOME_RULES_DOCS_PATH}/${rule.docFileName}`
    const outputPath = path.join(
      this.docsDescriptionDirectory,
      `${patternIdToCodacy(rule.ruleId)}.md`
    )

    try {
      const response = await axios.get<string>(url)
      await writeFile(outputPath, response.data)
    } catch (error) {
      console.error(
        wrapConsoleTextInColor(
          `Failed to download doc for ${rule.ruleId}: ${error}`,
          TerminalColor.Red
        )
      )
    }
  }

  private async emptyDocsDescriptionFolder(): Promise<void> {
    await fs.emptyDir(this.docsDescriptionDirectory)
  }

  private async writeFileInJson(
    file: string,
    json: Specification | DescriptionEntry[]
  ): Promise<void> {
    await writeFile(file, JSON.stringify(json, null, 2) + EOL)
  }
}
