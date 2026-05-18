# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Mini Translate — a Chrome Manifest V3 extension for inline translation, powered by the Gemini API. Vanilla JS, zero npm dependencies, no build step.

## Development

There is no build, lint, or test tooling. Load the unpacked extension to run it:

1. Open `chrome://extensions/`, enable Developer Mode
2. "Load unpacked" → select the repo root
3. After editing `content.js`/`styles.css`, reload the target page
4. After editing `background.js`/`manifest.json`, click the reload icon on the extension card

Inspect logs: content script logs appear in the page's DevTools console (prefixed `[mini-translate]`); the service worker has its own console via the "service worker" link on the extension card.

## Architecture

Three execution contexts communicate over `chrome.runtime` messaging:

- **`content.js`** — injected into `<all_urls>`. Owns all UI and user interaction. Stateless toward the network; never touches the API key.
- **`background.js`** — service worker. The *only* place that holds the API key and calls Gemini. Listens for `{ type: "TRANSLATE", text }` messages, reads `apiKey` from `chrome.storage.local`, returns `{ result }` or `{ error }`.
- **`popup.js` / `popup.html`** — settings UI. Validates and persists the API key to `chrome.storage.local`.

Key isolation is deliberate: the content script runs in untrusted page context, so the API key lives only in the service worker and storage.

### Two user features (both in `content.js`)

1. **Selection translation** — `mouseup` with selected text shows a "译" button near the selection; clicking it calls `sendTranslate` and renders a tooltip.
2. **Option-hover paragraph translation** — holding `⌥ Option` highlights the block element under the cursor (`findTranslatable` walks up to the nearest `BLOCK_TAGS` element with >20 chars); `⌥`+click inserts the translation as a sibling `<div>` directly below the original. Clicking an already-translated paragraph toggles it off. Option (not ⌘) is used to avoid colliding with the browser's native ⌘+click "open in new tab".

### Cross-cutting conventions

- **Page-level cache**: `content.js` keeps a `Map` of `text → translation`, cleared on page reload. Check it before calling `sendTranslate`.
- **Service worker wake-up**: `sendTranslate` retries once after 500ms because the MV3 service worker may be asleep when first messaged.
- **Error codes**: `background.js` throws string codes (`NO_KEY`, `RATE_LIMIT`, `INVALID_KEY`, `EMPTY_RESPONSE`, `HTTP_*`). `content.js`'s `errorMessage()` maps them to Chinese user-facing strings. Add new codes in both places.
- **Long text**: input over 2000 chars is truncated in `background.js`; the result is suffixed with `[原文过长已截断]`, and `[译文过长已截断]` is appended when Gemini's `finishReason` is `MAX_TOKENS`.
- **Model**: `gemini-2.5-flash-lite` via `generativelanguage.googleapis.com`. The model name is hardcoded as a URL constant in both `background.js` and `popup.js` — change both together.

## Conventions

- UI strings and comments addressed to users are Chinese; code comments are English.
- Injected DOM nodes use the `mini-translate-*` class prefix (see `styles.css`), with `z-index: 2147483647` to sit above page content.
