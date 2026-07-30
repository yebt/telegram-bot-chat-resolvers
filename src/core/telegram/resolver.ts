import type {
  ResolveSummary,
  ResolvedChat,
  ResolvedTopic,
  TelegramChat,
  TelegramMessage,
  TelegramUpdate,
} from './types'

interface Occurrence {
  chat: TelegramChat
  date: number
  message?: TelegramMessage
}

interface TopicAccumulator extends ResolvedTopic {
  /** Date of the occurrence the current name came from, so newer names win. */
  nameDate: number
}

interface ChatAccumulator extends Omit<ResolvedChat, 'topics'> {
  topics: Map<string, TopicAccumulator>
}

const GENERAL_TOPIC_KEY = 'general'

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined
}

/** Flattens an update into every (chat, timestamp) pair it carries. */
function occurrencesOf(update: TelegramUpdate): Occurrence[] {
  const messages = [
    update.message,
    update.edited_message,
    update.channel_post,
    update.edited_channel_post,
    update.callback_query?.message,
  ].filter(isDefined)

  const memberEvents = [update.my_chat_member, update.chat_member].filter(isDefined)

  return [
    ...messages.map((message) => ({ chat: message.chat, date: message.date, message })),
    ...memberEvents.map((event) => ({ chat: event.chat, date: event.date })),
  ]
}

function displayTitle(chat: TelegramChat): string {
  const personalName = [chat.first_name, chat.last_name].filter(Boolean).join(' ')
  return chat.title ?? (personalName || chat.username || `Chat ${chat.id}`)
}

/**
 * In a forum, `message_thread_id` is only present on messages that belong to a
 * topic. Its absence means the message lives in the General topic.
 */
function threadIdOf(message: TelegramMessage): number | null {
  if (message.chat.is_forum !== true) return null
  return message.message_thread_id ?? null
}

/** A topic name is never returned by the API on demand — it only leaks through service messages. */
function topicNameOf(message: TelegramMessage): string | null {
  return (
    message.forum_topic_created?.name ??
    message.forum_topic_edited?.name ??
    message.reply_to_message?.forum_topic_created?.name ??
    null
  )
}

function upsertTopic(chat: ChatAccumulator, occurrence: Occurrence): void {
  const { message, date } = occurrence
  if (!message) return

  const threadId = threadIdOf(message)
  const key = threadId === null ? GENERAL_TOPIC_KEY : String(threadId)
  const name = topicNameOf(message)

  const existing = chat.topics.get(key)
  if (!existing) {
    chat.topics.set(key, {
      threadId,
      name,
      lastActivity: date,
      updateCount: 1,
      nameDate: name === null ? -1 : date,
    })
    return
  }

  existing.updateCount += 1
  existing.lastActivity = Math.max(existing.lastActivity, date)
  if (name !== null && date >= existing.nameDate) {
    existing.name = name
    existing.nameDate = date
  }
}

/**
 * Builds the chat/topic tree out of whatever the update queue happens to hold.
 *
 * This is discovery, not enumeration: the Bot API offers no way to list the
 * chats a bot belongs to, nor the topics of a forum. Only chats with recent
 * activity can ever show up here.
 */
export function resolveChats(updates: TelegramUpdate[]): ResolveSummary {
  const chats = new Map<number, ChatAccumulator>()

  for (const update of updates) {
    for (const occurrence of occurrencesOf(update)) {
      const { chat, date } = occurrence

      let accumulator = chats.get(chat.id)
      if (!accumulator) {
        accumulator = {
          id: chat.id,
          type: chat.type,
          title: displayTitle(chat),
          username: chat.username ?? null,
          isForum: chat.is_forum === true,
          lastActivity: date,
          updateCount: 0,
          topics: new Map(),
        }
        chats.set(chat.id, accumulator)
      }

      accumulator.updateCount += 1
      accumulator.lastActivity = Math.max(accumulator.lastActivity, date)
      // Later payloads can carry richer metadata than the first one seen.
      accumulator.title = chat.title ? displayTitle(chat) : accumulator.title
      accumulator.username = chat.username ?? accumulator.username
      accumulator.isForum = accumulator.isForum || chat.is_forum === true

      upsertTopic(accumulator, occurrence)
    }
  }

  const resolved = [...chats.values()]
    .map<ResolvedChat>((chat) => ({
      id: chat.id,
      type: chat.type,
      title: chat.title,
      username: chat.username,
      isForum: chat.isForum,
      lastActivity: chat.lastActivity,
      updateCount: chat.updateCount,
      // Topics are only meaningful in forums; elsewhere the chat itself is the target.
      topics: chat.isForum
        ? [...chat.topics.values()]
            .map(({ nameDate: _nameDate, ...topic }) => topic)
            .sort((a, b) => b.lastActivity - a.lastActivity)
        : [],
    }))
    .sort((a, b) => b.lastActivity - a.lastActivity)

  return { chats: resolved, updatesScanned: updates.length }
}
