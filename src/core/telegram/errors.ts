import type { ApiResponse } from "./types";

export type TelegramErrorKind =
  | "aborted"
  | "network"
  | "invalid_token"
  | "webhook_conflict"
  | "rate_limited"
  | "forbidden"
  | "chat_not_found"
  | "thread_not_found"
  | "bad_request"
  | "server_error"
  | "malformed_response"
  | "unknown";

export class TelegramError extends Error {
  readonly kind: TelegramErrorKind;
  readonly errorCode: number | undefined;
  readonly description: string | undefined;
  readonly retryAfter: number | undefined;

  constructor(
    kind: TelegramErrorKind,
    message: string,
    options: {
      errorCode?: number;
      description?: string;
      retryAfter?: number;
      cause?: unknown;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "TelegramError";
    this.kind = kind;
    this.errorCode = options.errorCode;
    this.description = options.description;
    this.retryAfter = options.retryAfter;
  }
}

/** Maps a non-ok Bot API payload to a typed error. */
export function fromApiResponse(
  payload: ApiResponse<unknown>,
  httpStatus: number,
): TelegramError {
  const code = payload.error_code ?? httpStatus;
  const description = payload.description ?? `HTTP ${httpStatus}`;
  const retryAfter = payload.parameters?.retry_after;
  const lower = description.toLowerCase();

  const kind: TelegramErrorKind =
    code === 401
      ? "invalid_token"
      : code === 409
        ? "webhook_conflict"
        : code === 429
          ? "rate_limited"
          : code === 403
            ? "forbidden"
            : code === 404
              ? "invalid_token"
              : code >= 500
                ? "server_error"
                : lower.includes("message thread not found")
                  ? "thread_not_found"
                  : lower.includes("chat not found")
                    ? "chat_not_found"
                    : code === 400
                      ? "bad_request"
                      : "unknown";

  return new TelegramError(kind, description, {
    errorCode: code,
    description,
    retryAfter,
  });
}

export interface ErrorPresentation {
  title: string;
  detail: string;
  hint?: string;
}

/**
 * Turns any thrown value into copy a human can act on.
 * Every branch answers the same question: what does the user do next?
 */
export function describeError(error: unknown): ErrorPresentation {
  if (!(error instanceof TelegramError)) {
    return {
      title: "Unexpected error",
      detail: error instanceof Error ? error.message : String(error),
      hint: "Open the browser console for the full stack trace.",
    };
  }

  switch (error.kind) {
    case "aborted":
      return {
        title: "Request cancelled",
        detail: "The request was cancelled before it finished.",
      };

    case "network":
      return {
        title: "Could not reach Telegram",
        detail:
          "The request to api.telegram.org failed before getting a response.",
        hint: "Check your connection. Corporate proxies, VPNs and ad blockers often block the Telegram API.",
      };

    case "invalid_token":
      return {
        title: "Invalid bot token",
        detail: "Telegram rejected this token (401 Unauthorized).",
        hint: 'Copy it again from @BotFather. It looks like 123456789:AA... — no spaces, no "bot" prefix.',
      };

    case "webhook_conflict":
      return {
        title: "A webhook is active on this bot",
        detail:
          "Telegram refuses getUpdates while a webhook is registered, so pending events cannot be read.",
        hint: "Delete the webhook from your own infrastructure (deleteWebhook) and try again. This app will not touch it for you.",
      };

    case "rate_limited":
      return {
        title: "Rate limited",
        detail: error.retryAfter
          ? `Telegram asked to wait ${error.retryAfter}s before retrying.`
          : "Too many requests sent in a short window.",
        hint: "Wait a few seconds and retry.",
      };

    case "forbidden":
      return {
        title: "The bot is not allowed to post here",
        detail: error.description ?? "Telegram answered 403 Forbidden.",
        hint: "The bot was removed, blocked, or lacks permission to send messages in this chat.",
      };

    case "chat_not_found":
      return {
        title: "Chat not found",
        detail: "Telegram does not recognise this chat id for this bot.",
        hint: "The bot may have been removed from the group, or the supergroup was migrated to a new id.",
      };

    case "thread_not_found":
      return {
        title: "Topic not found",
        detail: "That message thread no longer exists in this group.",
        hint: "The topic may have been deleted. Try sending to the group itself (General) instead.",
      };

    case "server_error":
      return {
        title: "Telegram is having problems",
        detail: error.description ?? "The API answered with a 5xx error.",
        hint: "This is on Telegram’s side. Retry in a moment.",
      };

    case "malformed_response":
      return {
        title: "Unreadable response",
        detail: "The API answered with something that is not valid JSON.",
        hint: "Usually a captive portal or proxy intercepting the request.",
      };

    default:
      return {
        title: "Telegram rejected the request",
        detail: error.description ?? error.message,
        hint: error.errorCode ? `Error code ${error.errorCode}.` : undefined,
      };
  }
}
