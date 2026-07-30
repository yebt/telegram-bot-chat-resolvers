import { botProfileToText, describeBot, type BotProfile } from '../../../core/telegram/bot-profile'
import { getMe, getUpdates, getWebhookInfo, sendTestMessage } from '../../../core/telegram/client'
import { describeError, type ErrorPresentation } from '../../../core/telegram/errors'
import { resolveChats } from '../../../core/telegram/resolver'
import { isLikelyBotToken, normalizeToken } from '../../../core/telegram/token'
import type { ResolveSummary, ResolvedChat, ResolvedTopic, TelegramUser } from '../../../core/telegram/types'

interface Selection {
  chat: ResolvedChat
  topic: ResolvedTopic | null
}

interface AppState {
  token: string
  bot: TelegramUser | null
  summary: ResolveSummary | null
  selection: Selection | null
  busy: boolean
}

type NoticeTone = 'error' | 'warn' | 'info' | 'success'

const DEFAULT_TEST_MESSAGE = 'Test notification from Telegram Resolver.'

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function must<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`Missing required element: ${selector}`)
  return element
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  // textContent, never innerHTML: chat titles and topic names are attacker-controlled.
  if (text !== undefined) node.textContent = text
  return node
}

function clear(node: HTMLElement): void {
  node.replaceChildren()
}

function formatDate(unixSeconds: number): string {
  return dateFormatter.format(new Date(unixSeconds * 1000))
}

function topicLabel(topic: ResolvedTopic): string {
  if (topic.threadId === null) return 'General'
  return topic.name ?? `Topic #${topic.threadId}`
}

function buildNotice(tone: NoticeTone, presentation: ErrorPresentation): HTMLElement {
  const notice = element('div', `notice notice--${tone}`)
  notice.append(element('p', 'notice__title', presentation.title))
  notice.append(element('p', 'notice__detail mt-1', presentation.detail))
  if (presentation.hint) {
    notice.append(element('p', 'notice__hint mt-2', presentation.hint))
  }
  return notice
}

export function mountResolver(): void {
  const form = must<HTMLFormElement>('#resolve-form')
  const tokenInput = must<HTMLInputElement>('#token-input')
  const toggleTokenButton = must<HTMLButtonElement>('#toggle-token')
  const resolveButton = must<HTMLButtonElement>('#resolve-button')
  const feedback = must<HTMLElement>('#feedback')
  const botPlate = must<HTMLElement>('#bot-plate')
  const botBody = must<HTMLElement>('#bot-body')
  const chatsPlate = must<HTMLElement>('#chats-plate')
  const chatsSummary = must<HTMLElement>('#chats-summary')
  const chatList = must<HTMLUListElement>('#chat-list')
  const targetPlate = must<HTMLElement>('#target-plate')
  const targetBody = must<HTMLElement>('#target-body')

  const state: AppState = {
    token: '',
    bot: null,
    summary: null,
    selection: null,
    busy: false,
  }

  /* ---------------------------------------------------------------- *
   * Feedback
   * ---------------------------------------------------------------- */

  function showNotices(...notices: HTMLElement[]): void {
    clear(feedback)
    feedback.append(...notices)
  }

  function notify(tone: NoticeTone, presentation: ErrorPresentation): void {
    showNotices(buildNotice(tone, presentation))
  }

  function setBusy(busy: boolean, label: string): void {
    state.busy = busy
    resolveButton.disabled = busy
    tokenInput.disabled = busy
    resolveButton.textContent = label
  }

  /* ---------------------------------------------------------------- *
   * Rendering
   * ---------------------------------------------------------------- */

  function buildCapabilityChip(label: string, enabled: boolean | null): HTMLElement {
    const state = enabled === null ? 'unknown' : enabled ? 'on' : 'off'
    const chip = element('li', `chip chip--${state}`)
    chip.append(element('span', 'chip__dot'))
    chip.append(element('span', '', label))
    // The dot alone would encode meaning visually; state is also read out loud.
    chip.append(element('span', 'sr-only', `: ${state}`))
    chip.title = `${label}: ${state}`
    return chip
  }

  function renderBot(bot: TelegramUser): void {
    clear(botBody)

    const profile: BotProfile = describeBot(bot)

    const header = element('div', 'flex flex-wrap items-start justify-between gap-3')
    const identity = element('div', 'min-w-0')
    identity.append(element('p', 'text-3xl font-semibold leading-tight', profile.displayName))
    identity.append(element('p', 'entry__meta mt-1', profile.handle ?? 'no public username'))
    header.append(identity)

    const copyAllButton = element('button', 'stamp stamp--small shrink-0', 'Copy all')
    copyAllButton.type = 'button'
    copyAllButton.addEventListener('click', () => {
      void copyToClipboard(botProfileToText(profile), copyAllButton)
    })
    header.append(copyAllButton)
    botBody.append(header)

    const facts = element('div', 'mt-2 grid grid-cols-1 gap-x-6 sm:grid-cols-2')
    facts.append(buildCopyRow('name', profile.displayName))
    facts.append(buildCopyRow('username', profile.handle ?? '—'))
    facts.append(buildCopyRow('bot_id', String(profile.id)))
    facts.append(buildCopyRow('link', profile.link ?? '—'))
    botBody.append(facts)

    const capabilities = element('ul', 'mt-5 flex flex-wrap gap-2')
    for (const capability of profile.capabilities) {
      capabilities.append(buildCapabilityChip(capability.label, capability.enabled))
    }
    botBody.append(capabilities)

    // Privacy mode is the single most common reason a group never shows up.
    if (profile.privacyMode === true) {
      const warning = element('div', 'notice notice--warn mt-4')
      warning.append(element('p', 'notice__title', 'Privacy mode is enabled'))
      warning.append(
        element(
          'p',
          'notice__detail mt-1',
          'In groups this bot only receives commands and replies addressed to it. Ordinary messages never reach the update queue, so many chats stay invisible here.',
        ),
      )
      warning.append(
        element(
          'p',
          'notice__hint mt-2',
          'Disable it with /setprivacy in @BotFather, then send a new message in the group.',
        ),
      )
      botBody.append(warning)
    }

    botPlate.hidden = false
  }

  function renderTarget(): void {
    clear(targetBody)

    if (!state.selection) {
      targetPlate.hidden = true
      return
    }

    const { chat, topic } = state.selection

    const title = element('p', 'text-2xl font-semibold leading-tight', chat.title)
    const subtitle = element(
      'p',
      'entry__meta mt-1',
      topic ? topicLabel(topic) : chat.isForum ? 'General' : chat.type,
    )
    targetBody.append(title, subtitle)

    targetBody.append(buildCopyRow('chat_id', String(chat.id)))
    targetBody.append(
      buildCopyRow('message_thread_id', topic?.threadId != null ? String(topic.threadId) : '—'),
    )

    const divider = element('div', 'rule my-4')
    targetBody.append(divider)

    const messageLabel = element(
      'label',
      'font-mono text-xs tracking-widest uppercase',
      'Test message',
    )
    messageLabel.htmlFor = 'test-message'
    const messageInput = element('input', 'field mt-2')
    messageInput.id = 'test-message'
    messageInput.type = 'text'
    messageInput.value = DEFAULT_TEST_MESSAGE

    const sendButton = element('button', 'stamp mt-3 w-full', 'Send test notification')
    sendButton.type = 'button'

    const result = element('div', 'mt-3')

    sendButton.addEventListener('click', () => {
      void sendTest(messageInput, sendButton, result)
    })

    targetBody.append(messageLabel, messageInput, sendButton, result)
    targetPlate.hidden = false
  }

  /** A labelled value with a one-click copy, used for every id in the page. */
  function buildCopyRow(label: string, value: string): HTMLElement {
    const row = element('div', 'mt-4 flex items-end justify-between gap-3')
    const group = element('div', 'min-w-0')
    group.append(element('p', 'entry__meta', label))
    group.append(element('p', 'font-mono text-lg break-all', value))
    row.append(group)

    if (value !== '—') {
      const copyButton = element('button', 'stamp stamp--small shrink-0', 'Copy')
      copyButton.type = 'button'
      copyButton.addEventListener('click', () => {
        void copyToClipboard(value, copyButton)
      })
      row.append(copyButton)
    }

    return row
  }

  function buildTopicEntry(chat: ResolvedChat, topic: ResolvedTopic): HTMLLIElement {
    const item = element('li', '')
    const button = element('button', 'entry')
    button.type = 'button'
    const selected =
      state.selection?.chat.id === chat.id &&
      state.selection.topic?.threadId === topic.threadId
    button.setAttribute('aria-pressed', String(selected))

    button.append(element('p', 'font-body text-base', topicLabel(topic)))
    button.append(
      element(
        'p',
        'entry__meta mt-0.5',
        topic.threadId === null
          ? `no thread id · ${formatDate(topic.lastActivity)}`
          : `thread ${topic.threadId} · ${formatDate(topic.lastActivity)}`,
      ),
    )

    button.addEventListener('click', () => {
      state.selection = { chat, topic }
      renderChats()
      renderTarget()
    })

    item.append(button)
    return item
  }

  function buildChatEntry(chat: ResolvedChat): HTMLLIElement {
    const item = element('li', 'plate p-3')

    const button = element('button', 'entry')
    button.type = 'button'
    const selected = state.selection?.chat.id === chat.id && state.selection.topic === null
    button.setAttribute('aria-pressed', String(selected))

    const heading = element('p', 'text-lg font-semibold leading-tight', chat.title)
    const meta = element(
      'p',
      'entry__meta mt-1',
      [
        chat.type,
        chat.isForum ? 'forum' : null,
        chat.username ? `@${chat.username}` : null,
        `id ${chat.id}`,
        formatDate(chat.lastActivity),
      ]
        .filter(Boolean)
        .join(' · '),
    )
    button.append(heading, meta)

    button.addEventListener('click', () => {
      state.selection = { chat, topic: null }
      renderChats()
      renderTarget()
    })

    item.append(button)

    if (chat.isForum) {
      const topicsLabel = element(
        'p',
        'entry__meta mt-3',
        chat.topics.length > 0
          ? `${chat.topics.length} topic${chat.topics.length === 1 ? '' : 's'} seen in recent events`
          : 'No topic activity in the recent events',
      )
      item.append(topicsLabel)

      if (chat.topics.length > 0) {
        const topicList = element('ul', 'mt-2 flex flex-col gap-2 pl-3 border-l-2 border-[var(--edge)]')
        for (const topic of chat.topics) {
          topicList.append(buildTopicEntry(chat, topic))
        }
        item.append(topicList)
      }
    }

    return item
  }

  function renderChats(): void {
    if (!state.summary) {
      chatsPlate.hidden = true
      return
    }

    const { chats, updatesScanned } = state.summary
    chatsSummary.textContent = `${chats.length} chat${chats.length === 1 ? '' : 's'} found in ${updatesScanned} recent update${updatesScanned === 1 ? '' : 's'}`

    clear(chatList)
    for (const chat of chats) {
      chatList.append(buildChatEntry(chat))
    }

    chatsPlate.hidden = false
  }

  function resetResults(): void {
    state.bot = null
    state.summary = null
    state.selection = null
    botPlate.hidden = true
    chatsPlate.hidden = true
    targetPlate.hidden = true
    clear(chatList)
    clear(botBody)
    clear(targetBody)
  }

  /* ---------------------------------------------------------------- *
   * Actions
   * ---------------------------------------------------------------- */

  async function copyToClipboard(value: string, button: HTMLButtonElement): Promise<void> {
    const original = button.textContent
    try {
      await navigator.clipboard.writeText(value)
      button.textContent = 'Copied'
    } catch {
      button.textContent = 'Blocked'
    }
    window.setTimeout(() => {
      button.textContent = original
    }, 1500)
  }

  async function resolve(): Promise<void> {
    const token = normalizeToken(tokenInput.value)
    state.token = token

    if (token === '') {
      notify('error', {
        title: 'No token given',
        detail: 'Paste the token @BotFather gave you.',
      })
      return
    }

    if (!isLikelyBotToken(token)) {
      notify('error', {
        title: 'That does not look like a bot token',
        detail: 'A bot token is a numeric id, a colon, and a long random string.',
        hint: 'Example shape: 123456789:AAEhBOweik6ad9r_QXsyDDdBs1LNMlq3Nfw',
      })
      return
    }

    resetResults()
    setBusy(true, 'Resolving…')
    notify('info', { title: 'Reading the queue', detail: 'Asking Telegram about this bot…' })

    try {
      const bot = await getMe(token)
      state.bot = bot
      renderBot(bot)

      // Checked before getUpdates on purpose: a registered webhook makes
      // getUpdates fail with 409, and the reason is worth stating up front.
      const webhook = await getWebhookInfo(token)
      if (webhook.url !== '') {
        const notice = buildNotice('warn', {
          title: 'A webhook is active on this bot',
          detail: `Telegram is delivering updates to ${webhook.url} instead of queueing them, so getUpdates cannot read anything (409 Conflict). ${webhook.pending_update_count} update(s) pending.`,
          hint: 'Remove the webhook yourself with deleteWebhook when you are sure nothing depends on it. This app will not do it for you.',
        })
        showNotices(notice)
        return
      }

      const updates = await getUpdates(token)
      const summary = resolveChats(updates)
      state.summary = summary
      renderChats()

      if (summary.chats.length === 0) {
        notify('warn', {
          title: 'No chats in the update queue',
          detail:
            'The bot has no readable events right now. The queue only holds the last 24 hours, and it is emptied whenever another process polls the same bot.',
          hint: 'Send a message in the group (or mention the bot if privacy mode is on) and resolve again.',
        })
        return
      }

      notify('success', {
        title: 'Queue read',
        detail: `${summary.chats.length} chat(s) discovered from ${summary.updatesScanned} update(s). Only chats with activity in the last 24 hours can appear.`,
      })
    } catch (error) {
      notify('error', describeError(error))
    } finally {
      setBusy(false, 'Resolve')
    }
  }

  async function sendTest(
    messageInput: HTMLInputElement,
    button: HTMLButtonElement,
    result: HTMLElement,
  ): Promise<void> {
    if (!state.selection) return

    const text = messageInput.value.trim()
    clear(result)

    if (text === '') {
      result.append(
        buildNotice('error', {
          title: 'Empty message',
          detail: 'Telegram rejects empty messages. Write something to send.',
        }),
      )
      return
    }

    const { chat, topic } = state.selection
    button.disabled = true
    button.textContent = 'Sending…'

    try {
      const message = await sendTestMessage(state.token, {
        chatId: chat.id,
        threadId: topic?.threadId ?? null,
        text,
      })
      result.append(
        buildNotice('success', {
          title: 'Notification delivered',
          detail: `Message ${message.message_id} sent to ${chat.title}${topic ? ` → ${topicLabel(topic)}` : ''}.`,
        }),
      )
    } catch (error) {
      result.append(buildNotice('error', describeError(error)))
    } finally {
      button.disabled = false
      button.textContent = 'Send test notification'
    }
  }

  /* ---------------------------------------------------------------- *
   * Wiring
   * ---------------------------------------------------------------- */

  toggleTokenButton.addEventListener('click', () => {
    const revealed = tokenInput.type === 'text'
    tokenInput.type = revealed ? 'password' : 'text'
    toggleTokenButton.setAttribute('aria-pressed', String(!revealed))
    toggleTokenButton.textContent = revealed ? 'Reveal' : 'Hide'
  })

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    if (state.busy) return
    void resolve()
  })
}
