import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"

import { type Codacyrc, Pattern } from "codacy-seed"

import { patternIdToBiome } from "lib/models/patterns.ts"
import { debug } from "lib/utils/logging.ts"
import { toolVersion } from "lib/utils/metadata.ts"

const BIOME_CONFIG_DIR = "/tmp/codacy-biome-config"
export const BIOME_CONFIG_PATH = path.join(BIOME_CONFIG_DIR, "biome.json")

interface BiomeRule {
  level: "error" | "warn" | "off"
}

interface BiomeLinterRules {
  recommended: boolean
  [group: string]: boolean | { [rule: string]: "error" | "warn" | "off" | BiomeRule }
}

interface BiomeConfig {
  $schema: string
  linter: {
    enabled: boolean
    rules: BiomeLinterRules
  }
  javascript: {
    parser: {
      unsafeParameterDecoratorsEnabled: boolean
    }
  }
}

export async function createBiomeConfig(
  srcDirPath: string,
  codacyrc: Codacyrc
): Promise<{ configPath: string | undefined; files: string[] }> {
  const patterns = codacyrc.tools?.[0]?.patterns ?? []
  const files = generateFilesToAnalyze(srcDirPath, codacyrc)

  const repoHasBiomeConfig = existsBiomeConfigInRepoRoot(srcDirPath)

  if (patterns.length === 0 && repoHasBiomeConfig) {
    // Use the repo's own biome.json
    debug("configCreator: using repo biome config")
    return { configPath: srcDirPath, files }
  }

  // Generate a biome.json with the specified patterns (or recommended if none)
  const config = generateBiomeConfig(patterns)
  await fs.mkdir(BIOME_CONFIG_DIR, { recursive: true })
  await fs.writeFile(BIOME_CONFIG_PATH, JSON.stringify(config, null, 2))
  debug(`configCreator: wrote biome config to ${BIOME_CONFIG_PATH}`)

  return { configPath: BIOME_CONFIG_DIR, files }
}

function generateFilesToAnalyze(srcDirPath: string, codacyrc: Codacyrc): string[] {
  if (codacyrc.files && codacyrc.files.length > 0 ) {
    return codacyrc.files.map((f) => path.join(srcDirPath, f))
    }else {
      return ["."]
  }
}

function generateBiomeConfig(patterns: Pattern[]): BiomeConfig {
  const rules: BiomeLinterRules = { recommended: false }

  if (patterns.length === 0) {
    // No patterns specified and no repo config → use recommended
    rules.recommended = true
  } else {
    // Enable only the specified patterns
    for (const pattern of patterns) {
      const biomeId = patternIdToBiome(pattern.patternId)
      // biomeId = "lint/suspicious/noDoubleEquals"
      const parts = biomeId.split("/")
      if (parts.length !== 3) continue

      const group = parts[1]
      const ruleName = parts[2]

      if (!group || !ruleName) continue

      if (typeof rules[group] !== "object" || rules[group] === null) {
        rules[group] = {}
      }
      ;(rules[group] as { [rule: string]: "error" | "warn" | "off" })[ ruleName] = "error"
    }
  }

  return {
    $schema: `https://biomejs.dev/schemas/${toolVersion}/schema.json`,
    linter: {
      enabled: true,
      rules,
    },
    javascript: {
      parser: {
        unsafeParameterDecoratorsEnabled: true,
      },
    },
  }
}

function existsBiomeConfigInRepoRoot(srcDirPath: string): boolean {
  return (
    existsSync(path.join(srcDirPath, "biome.json")) ||
    existsSync(path.join(srcDirPath, "biome.jsonc")) ||
    existsSync(path.join(srcDirPath, ".biome.json")) ||
    existsSync(path.join(srcDirPath, ".biome.jsonc"))
  )
}
