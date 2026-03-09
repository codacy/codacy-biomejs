import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

export const toolName = "biome"

function getToolVersion(): string {
  try {
    const pkg = require("@biomejs/biome/package.json") as { version: string }
    return pkg.version
  } catch {
    return "unknown"
  }
}

export const toolVersion: string = getToolVersion()
