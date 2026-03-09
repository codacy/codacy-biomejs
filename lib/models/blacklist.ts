const blacklistRegexes: RegExp[] = []

export function isBlacklisted(_ruleId: string): boolean {
  return blacklistRegexes.some((regex) => regex.test(_ruleId))
}

export function isBlacklistedOnlyFromDocumentation(_ruleId: string): boolean {
  return false
}
