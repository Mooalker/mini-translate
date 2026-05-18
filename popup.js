const input = document.getElementById("apiKey");
const saveBtn = document.getElementById("saveBtn");
const clearBtn = document.getElementById("clearBtn");
const statusEl = document.getElementById("status");

const GEMINI_TEST_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";

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

  const result = await validateKey(key);
  saveBtn.disabled = false;

  if (result.ok) {
    await chrome.storage.local.set({ apiKey: key });
    setStatus("ok", "✓ 有效，已保存");
  } else if (result.code === "rate_limit") {
    // Key reached Google but we're throttled; it's valid, save it.
    await chrome.storage.local.set({ apiKey: key });
    setStatus("ok", "✓ 已保存（暂时请求过频，未能验证）");
  } else if (result.code === "quota") {
    // Key is valid but the project has no usable quota.
    await chrome.storage.local.set({ apiKey: key });
    setStatus("err", "⚠ 已保存，但该 key 无可用配额：需在 Google Cloud 启用结算");
  } else if (result.code === "network") {
    setStatus("err", "✗ 无法连接 Google，请检查代理 / VPN");
  } else {
    // Surface Google's real status and message instead of a blanket
    // "Key 无效" — the actual reason (API disabled, deprecated model,
    // restricted key, …) is what the user needs to act on.
    setStatus("err", `✗ 验证失败（${result.code}）：${result.detail || "请检查 API Key"}`);
  }
});

clearBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove("apiKey");
  input.value = "";
  setStatus("", "");
});

// Returns { ok: true } or { ok: false, code, detail }.
// code: "network" | "rate_limit" | "quota" | "http_<status>"
async function validateKey(key) {
  let res;
  try {
    res = await fetch(GEMINI_TEST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ parts: [{ text: "Hi" }] }] }),
    });
  } catch (e) {
    // fetch throws on DNS / connection / TLS failure — almost always a
    // proxy/VPN problem, not a bad key.
    return { ok: false, code: "network", detail: e.message };
  }

  if (res.ok) return { ok: true };

  const body = await res.text().catch(() => "");
  if (res.status === 429) {
    return {
      ok: false,
      code: /limit:\s*0\b/.test(body) ? "quota" : "rate_limit",
      detail: body,
    };
  }

  // 400 / 403 / 404 / … — pull Google's human-readable message out.
  let detail = body;
  try {
    detail = JSON.parse(body)?.error?.message || body;
  } catch (_) {
    /* body wasn't JSON — use it as-is */
  }
  return { ok: false, code: `http_${res.status}`, detail };
}

function setStatus(type, msg) {
  statusEl.textContent = msg;
  statusEl.className = "status" + (type ? ` ${type}` : "");
}
