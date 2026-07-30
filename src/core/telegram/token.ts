/** A bot token looks like `<bot_id>:<35 url-safe chars>`. */
const TOKEN_PATTERN = /^\d{5,}:[A-Za-z0-9_-]{30,}$/

export function normalizeToken(raw: string): string {
  return raw.trim().replace(/^bot/i, '')
}

export function isLikelyBotToken(token: string): boolean {
  return TOKEN_PATTERN.test(token)
}

/** Never render a full token back to the screen. */
export function maskToken(token: string): string {
  const [botId] = token.split(':')
  return botId ? `${botId}:${'•'.repeat(8)}` : '•'.repeat(8)
}
