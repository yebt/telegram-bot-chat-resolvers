/**
 * Minimal typings for the subset of the Telegram Bot API this app consumes.
 * Only the fields that are actually read are declared.
 */

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  /** false when privacy mode is enabled: the bot only receives commands and mentions in groups. */
  can_read_all_group_messages?: boolean;
  can_join_groups?: boolean;
  supports_inline_queries?: boolean;
  can_connect_to_business?: boolean;
  has_main_web_app?: boolean;
}

export type ChatType = "private" | "group" | "supergroup" | "channel";

export interface TelegramChat {
  id: number;
  type: ChatType;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  /** true for supergroups with the Topics feature enabled. */
  is_forum?: boolean;
}

export interface ForumTopicCreated {
  name: string;
  icon_color?: number;
  icon_custom_emoji_id?: string;
}

export interface ForumTopicEdited {
  name?: string;
  icon_custom_emoji_id?: string;
}

export interface TelegramMessage {
  message_id: number;
  date: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
  message_thread_id?: number;
  is_topic_message?: boolean;
  forum_topic_created?: ForumTopicCreated;
  forum_topic_edited?: ForumTopicEdited;
  reply_to_message?: TelegramMessage;
}

export interface ChatMemberUpdated {
  chat: TelegramChat;
  date: number;
}

export interface CallbackQuery {
  id: string;
  message?: TelegramMessage;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
  my_chat_member?: ChatMemberUpdated;
  chat_member?: ChatMemberUpdated;
  callback_query?: CallbackQuery;
}

export interface WebhookInfo {
  url: string;
  pending_update_count: number;
  last_error_message?: string;
  last_error_date?: number;
}

export interface ApiResponse<T> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
  parameters?: {
    retry_after?: number;
    migrate_to_chat_id?: number;
  };
}

/* ------------------------------------------------------------------ *
 * Domain model — what the UI actually works with.
 * ------------------------------------------------------------------ */

export interface ResolvedTopic {
  /** null means the forum "General" topic (messages sent without message_thread_id). */
  threadId: number | null;
  name: string | null;
  /** Unix seconds of the most recent activity seen for this topic. */
  lastActivity: number;
  updateCount: number;
}

export interface ResolvedChat {
  id: number;
  type: ChatType;
  title: string;
  username: string | null;
  isForum: boolean;
  lastActivity: number;
  updateCount: number;
  topics: ResolvedTopic[];
}

export interface ResolveSummary {
  chats: ResolvedChat[];
  updatesScanned: number;
}
