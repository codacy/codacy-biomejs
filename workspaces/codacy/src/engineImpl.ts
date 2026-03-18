import { execFile } from "node:child_process"
import { promisify } from "node:util"

import { type Codacyrc, Engine, ToolResult } from "codacy-seed"

import { createBiomeConfig } from "codacy/src/configCreator.ts"
import { type BiomeOutput, convertResults } from "codacy/src/convertResults.ts"
import { debug } from "lib/utils/logging.ts"
import { toolName } from "lib/utils/metadata.ts"

const execFileAsync = promisify(execFile)

const BIOME_BINARY = "biome"
const MAX_BUFFER = 512 * 1024 * 1024 // 512 MB

async function runBiome(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync(BIOME_BINARY, args, {
      maxBuffer: MAX_BUFFER,
    })
    return stdout
  } catch (err) {
    
    //Biome exits with code 1 when it finds lint issues — stdout still has valid JSON
    if (typeof (err as { stdout: unknown }).stdout === "string") {
      return (err as { stdout: string }).stdout
    }
    // Todo: we should handle other types of errors (e.g., binary not found, invalid args) 
    // and return them in a way that Codacy can report them properly instead of just crashing the engine
    throw err
  }
}

export const engineImpl: Engine = async function (
  codacyrc?: Codacyrc
): Promise<ToolResult[]> {
  if (!codacyrc || codacyrc.tools?.[0]?.name !== toolName) {
    throw new Error("codacyrc is not defined")
  }

  const srcDirPath = "/src"
  const { configPath, files } = await createBiomeConfig(srcDirPath, codacyrc)

  const args = ["lint", "--reporter=json"]

  if (configPath) {
    args.push(`--config-path=${configPath}`)
  }

  args.push(...files)

  debug(`engineImpl: running biome with args: ${args.join(" ")}`)

  const stdout = await runBiome(args)

  if (!stdout.trim()) {
    return []
  }

  const biomeOutput = JSON.parse(stdout) as BiomeOutput

  debug(`engineImpl: ${biomeOutput.diagnostics.length} diagnostics`)

  const results = convertResults(biomeOutput).map((r) => r.relativeTo(srcDirPath))
  return results
}
