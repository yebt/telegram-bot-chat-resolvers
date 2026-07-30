import { TelegramError, fromApiResponse } from './errors'
import { isLikelyBotToken } from './token'
import type { ApiResponse, TelegramMessage, TelegramUpdate, TelegramUser, WebhookInfo } from './types'

const API_ORIGIN = 'https://api.telegram.org'

/** Update types worth scanning to discover chats. */
const DISCOVERY_UPDATE_TYPES = [
  'message',
  'edited_message',
  'channel_post',
  'edited_channel_post',
  'my_chat_member',
  'chat_member',
  'callback_query',
]

type RequestParams = Record<string, string | number | boolean | undefined>

export interface RequestOptions {
  signal?: AbortSignal
}

/**
 * Every call is a GET with query params on purpose: it keeps the request a
 * CORS "simple request", so the browser never fires a preflight the Bot API
 * would not answer. The token stays in this browser — nothing is proxied.
 */
async function callApi<T>(
  token: string,
  method: string,
  params: RequestParams = {},
  options: RequestOptions = {},
): Promise<T> {
  // Guard before the token reaches the URL path: it is interpolated raw
  // (its charset is already path-safe) so anything malformed must be rejected
  // here instead of building a request to an unintended path.
  if (!isLikelyBotToken(token)) {
    throw new TelegramError('invalid_token', 'The token does not have the shape of a bot token')
  }

  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value))
  }

  const url = `${API_ORIGIN}/bot${token}/${method}?${query.toString()}`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      referrerPolicy: 'no-referrer',
      signal: options.signal,
    })
  } catch (cause) {
    if (options.signal?.aborted) {
      throw new TelegramError('aborted', 'Request aborted', { cause })
    }
    throw new TelegramError('network', 'Network request to the Telegram API failed', { cause })
  }

  let payload: ApiResponse<T>
  try {
    payload = (await response.json()) as ApiResponse<T>
  } catch (cause) {
    throw new TelegramError('malformed_response', 'The Telegram API response was not valid JSON', {
      errorCode: response.status,
      cause,
    })
  }

  if (!payload.ok || payload.result === undefined) {
    throw fromApiResponse(payload, response.status)
  }

  return payload.result
}

export function getMe(token: string, options?: RequestOptions): Promise<TelegramUser> {
  return callApi<TelegramUser>(token, 'getMe', {}, options)
}

export function getWebhookInfo(token: string, options?: RequestOptions): Promise<WebhookInfo> {
  return callApi<WebhookInfo>(token, 'getWebhookInfo', {}, options)
}

/**
 * Reads the pending update queue WITHOUT an `offset`.
 *
 * This matters: passing an offset confirms updates and permanently drops them
 * from the queue. A real bot polling the same token would silently lose those
 * events. Without an offset Telegram only replays them, so this app is a
 * read-only observer.
 */
export function getUpdates(token: string, options?: RequestOptions): Promise<TelegramUpdate[]> {
  return callApi<TelegramUpdate[]>(
    token,
    'getUpdates',
    {
      limit: 100,
      timeout: 0,
      allowed_updates: JSON.stringify(DISCOVERY_UPDATE_TYPES),
    },
    options,
  )
}

export interface SendTestMessageInput {
  chatId: number
  threadId: number | null
  text: string
}

export function sendTestMessage(
  token: string,
  { chatId, threadId, text }: SendTestMessageInput,
  options?: RequestOptions,
): Promise<TelegramMessage> {
  return callApi<TelegramMessage>(
    token,
    'sendMessage',
    {
      chat_id: chatId,
      message_thread_id: threadId ?? undefined,
      text,
      disable_notification: false,
    },
    options,
  )
}
