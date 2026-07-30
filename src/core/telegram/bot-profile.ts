import type { TelegramUser } from './types'

export interface BotCapability {
  label: string
  /** null when the API did not report the flag at all. */
  enabled: boolean | null
}

export interface BotProfile {
  id: number
  displayName: string
  username: string | null
  handle: string | null
  link: string | null
  /** true means privacy mode is ON, so the bot only sees commands and mentions in groups. */
  privacyMode: boolean | null
  capabilities: BotCapability[]
}

export function describeBot(user: TelegramUser): BotProfile {
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ')
  const username = user.username ?? null

  return {
    id: user.id,
    displayName: displayName || `Bot ${user.id}`,
    username,
    handle: username ? `@${username}` : null,
    link: username ? `https://t.me/${username}` : null,
    privacyMode:
      user.can_read_all_group_messages === undefined ? null : !user.can_read_all_group_messages,
    capabilities: [
      { label: 'Can join groups', enabled: user.can_join_groups ?? null },
      { label: 'Reads all group messages', enabled: user.can_read_all_group_messages ?? null },
      { label: 'Inline queries', enabled: user.supports_inline_queries ?? null },
      { label: 'Business connection', enabled: user.can_connect_to_business ?? null },
      { label: 'Main web app', enabled: user.has_main_web_app ?? null },
    ],
  }
}

/** Plain-text dump of the bot identity, for a single copy action. */
export function botProfileToText(profile: BotProfile): string {
  const lines = [
    `name: ${profile.displayName}`,
    `username: ${profile.handle ?? '—'}`,
    `bot_id: ${profile.id}`,
    `link: ${profile.link ?? '—'}`,
    `privacy_mode: ${profile.privacyMode === null ? 'unknown' : profile.privacyMode ? 'on' : 'off'}`,
  ]
  return lines.join('\n')
}
