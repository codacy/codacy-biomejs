import { execFile } from "node:child_process"
import { promisify } from "node:util"

import { type Codacyrc, Engine, ToolResult } from "codacy-seed"

import { createBiomeConfig } from "codacy/src/configCreator.ts"
import { type BiomeOutput, convertResults } from "codacy/src/convertResults.ts"
import { debug } from "lib/utils/logging.ts";
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
      debug(`runBiome: biome exited with error code but has stdout (this is normal for lint issues)`)
      return (err as { stdout: string }).stdout
    }
    // Todo: we should handle other types of errors (e.g., binary not found, invalid args) 
    // and return them in a way that Codacy can report them properly instead of just crashing the engine
    debug(`runBiome: error without stdout - ${err}`)
    debug(`runBiome: error details = ${JSON.stringify(err, Object.getOwnPropertyNames(err))}`)
    throw err
  }
}

export const engineImpl: Engine = async function (
  codacyrc?: Codacyrc
): Promise<ToolResult[]> {
  if (!codacyrc || codacyrc.tools?.[0]?.name !== toolName) {
    throw new Error("codacyrc is not defined")
  }

  debug(`engineImpl: codacyrc.files = ${JSON.stringify(codacyrc.files)}`)
  debug(`engineImpl: codacyrc.tools[0].patterns.length = ${codacyrc.tools?.[0]?.patterns?.length ?? 0}`)

  const srcDirPath = "/src"
  const { configPath, files } = await createBiomeConfig(srcDirPath, codacyrc)

  debug(`engineImpl: files to analyze = ${JSON.stringify(files)}`)

  const args = ["lint", "--reporter=json"]

  if (configPath) {
    args.push(`--config-path=${configPath}`)
  }

  args.push(...files)

  debug(`engineImpl: running biome with args: ${args.join(" ")}`)

  const stdout = await runBiome(args)

  debug(`engineImpl: biome stdout length: ${stdout.length} bytes`)
  debug(`engineImpl: biome stdout (first 500 chars): ${stdout.substring(0, 500)}`)

  if (!stdout.trim()) {
    debug(`engineImpl: stdout is empty, returning 0 results`)
    return []
  }

  const biomeOutput = JSON.parse(stdout) as BiomeOutput

  debug(`engineImpl: ${biomeOutput.diagnostics.length} diagnostics`)


  const results = convertResults(biomeOutput).map((r) => r.relativeTo(srcDirPath))
  return results
}

