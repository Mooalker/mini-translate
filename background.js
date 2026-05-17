const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent";

async function translate(text, apiKey) {
  const truncated = text.length > 2000 ? text.slice(0, 2000) + "..." : text;
  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `Translate the following text to Chinese. Output only the translation, no explanation.\n\n${truncated}`,
            },
          ],
        },
      ],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
    }),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 429) throw new Error("RATE_LIMIT");
    if (status === 400 || status === 403) throw new Error("INVALID_KEY");
    throw new Error(`HTTP_${status}`);
  }

  const data = await response.json();
  const result = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!result) throw new Error("EMPTY_RESPONSE");

  const wasLong = text.length > 2000;
  return wasLong ? result + "\n[文本已截断]" : result;
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
