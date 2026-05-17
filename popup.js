const input = document.getElementById("apiKey");
const saveBtn = document.getElementById("saveBtn");
const clearBtn = document.getElementById("clearBtn");
const statusEl = document.getElementById("status");

const GEMINI_TEST_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent";

// Load existing key
chrome.storage.local.get("apiKey", ({ apiKey }) => {
  if (apiKey) {
    input.value = apiKey;
    setStatus("ok", "✓ 已配置");
  }
});

saveBtn.addEventListener("click", async () => {
  const key = input.value.trim();
  if (!key) {
    setStatus("err", "请输入 API Key");
    return;
  }

  setStatus("checking", "验证中...");
  saveBtn.disabled = true;

  const valid = await validateKey(key);
  saveBtn.disabled = false;

  if (valid === true) {
    await chrome.storage.local.set({ apiKey: key });
    setStatus("ok", "✓ 有效，已保存");
  } else if (valid === "rate_limit") {
    // Key likely valid but we're rate limited; save anyway
    await chrome.storage.local.set({ apiKey: key });
    setStatus("ok", "✓ 已保存（无法验证：请求过频）");
  } else {
    setStatus("err", "✗ Key 无效，请检查后重试");
  }
});

clearBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove("apiKey");
  input.value = "";
  setStatus("", "");
});

async function validateKey(key) {
  try {
    const res = await fetch(GEMINI_TEST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Hi" }] }],
        generationConfig: { maxOutputTokens: 1 },
      }),
    });
    if (res.ok) return true;
    if (res.status === 429) return "rate_limit";
    return false;
  } catch {
    return false;
  }
}

function setStatus(type, msg) {
  statusEl.textContent = msg;
  statusEl.className = "status" + (type ? ` ${type}` : "");
}
