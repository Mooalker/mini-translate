const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";

const MAX_INPUT_CHARS = 2000;
const REQUEST_TIMEOUT_MS = 15000;

async function translate(text, apiKey) {
  const wasLong = text.length > MAX_INPUT_CHARS;
  const input = wasLong ? text.slice(0, MAX_INPUT_CHARS) + "..." : text;

  // Abort the request if it hangs, so the UI never stalls on "翻译中...".
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(GEMINI_API_URL, {
      method: "POST",
      // Key passed via header, not URL query string, to keep it out of logs.
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Translate the following text to Chinese. Output only the translation, no explanation.\n\n${input}`,
              },
            ],
          },
        ],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
      }),
    });
  } catch (err) {
    if (err.name === "AbortError") throw new Error("TIMEOUT");
    throw new Error("NETWORK");
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const status = response.status;
    if (status === 429) {
      // 429 is RESOURCE_EXHAUSTED. "limit: 0" means the project has no quota
      // at all for this model (free tier unavailable / billing not enabled) —
      // a structural problem, not a transient burst worth retrying.
      const body = await response.text().catch(() => "");
      throw new Error(/limit:\s*0\b/.test(body) ? "QUOTA_EXHAUSTED" : "RATE_LIMIT");
    }
    if (status === 401 || status === 403) throw new Error("INVALID_KEY");
    if (status === 400) {
      // 400 covers both a bad key and a malformed request — disambiguate
      // from the error body so the user-facing message isn't misleading.
      const body = await response.text().catch(() => "");
      throw new Error(/api[_ ]?key/i.test(body) ? "INVALID_KEY" : "BAD_REQUEST");
    }
    throw new Error(`HTTP_${status}`);
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0];
  const result = candidate?.content?.parts?.[0]?.text;
  if (!result) throw new Error("EMPTY_RESPONSE");

  const notes = [];
  if (wasLong) notes.push("[原文过长已截断]");
  if (candidate.finishReason === "MAX_TOKENS") notes.push("[译文过长已截断]");
  return notes.length ? `${result}\n${notes.join(" ")}` : result;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "OPEN_POPUP") {
    // chrome.action.openPopup() is available in Chrome 127+; ignore failures
    // (e.g. older Chrome, or no focused window) — fire-and-forget.
    try {
      chrome.action.openPopup?.()?.catch(() => {});
    } catch (_) {
      /* openPopup unsupported or threw synchronously */
    }
    return false;
  }

  if (message.type !== "TRANSLATE") return false;

  (async () => {
    try {
      const { apiKey } = await chrome.storage.local.get("apiKey");
      if (!apiKey) {
        sendResponse({ error: "NO_KEY" });
        return;
      }
      const result = await translate(message.text, apiKey);
      sendResponse({ result });
    } catch (err) {
      sendResponse({ error: err.message || "UNKNOWN" });
    }
  })();

  return true; // keep message channel open for async response
});
