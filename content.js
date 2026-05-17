console.log("[mini-translate] content script loaded ✓");

// Translation cache: text → translated result (page-level, clears on refresh)
const cache = new Map();

// Track Command key state
let cmdDown = false;
let hoveredEl = null;
let highlightedEl = null;

// ─── DOM helpers ────────────────────────────────────────────────────────────

function removeAllTooltips() {
  document
    .querySelectorAll(".mini-translate-tooltip, .mini-translate-btn")
    .forEach((el) => el.remove());
}

function removeHighlight() {
  if (highlightedEl) {
    highlightedEl.style.outline = highlightedEl._mtOrigOutline ?? "";
    highlightedEl._mtOrigOutline = undefined;
    highlightedEl = null;
  }
}

function showTooltip(text, anchorRect) {
  removeAllTooltips();
  const div = document.createElement("div");
  div.className = "mini-translate-tooltip";
  div.textContent = text;
  div.style.top = `${anchorRect.bottom + window.scrollY + 6}px`;
  div.style.left = `${anchorRect.left + window.scrollX}px`;
  document.body.appendChild(div);
}

function showTranslateBtn(anchorRect) {
  removeAllTooltips();
  const btn = document.createElement("button");
  btn.className = "mini-translate-btn";
  btn.textContent = "译";
  btn.style.top = `${anchorRect.top + window.scrollY - 28}px`;
  btn.style.left = `${anchorRect.right + window.scrollX + 4}px`;
  document.body.appendChild(btn);
  return btn;
}

function showInlineResult(targetEl, text) {
  // Remove existing result below this element
  const existing = targetEl.nextElementSibling;
  if (existing && existing.classList.contains("mini-translate-result")) {
    existing.remove();
  }
  const div = document.createElement("div");
  div.className = "mini-translate-result";
  div.textContent = text;
  targetEl.after(div);
}

function showInlineLoading(targetEl) {
  const existing = targetEl.nextElementSibling;
  if (existing && existing.classList.contains("mini-translate-result")) {
    existing.remove();
  }
  const div = document.createElement("div");
  div.className = "mini-translate-result mini-translate-loading";
  div.textContent = "翻译中...";
  targetEl.after(div);
  return div;
}

function showInlineError(targetEl, msg) {
  const existing = targetEl.nextElementSibling;
  if (existing && existing.classList.contains("mini-translate-result")) {
    existing.remove();
  }
  const div = document.createElement("div");
  div.className = "mini-translate-result mini-translate-error";
  div.textContent = msg;
  targetEl.after(div);
}

// ─── Translation call with SW wake-up retry ─────────────────────────────────

async function sendTranslate(text) {
  const msg = { type: "TRANSLATE", text };
  try {
    return await chrome.runtime.sendMessage(msg);
  } catch (_) {
    // Service worker may be sleeping; wait and retry once
    await new Promise((r) => setTimeout(r, 500));
    return await chrome.runtime.sendMessage(msg);
  }
}

function errorMessage(code) {
  const map = {
    NO_KEY: "请先在插件设置中配置 Gemini API Key",
    RATE_LIMIT: "请求过频，稍后再试",
    INVALID_KEY: "API Key 无效，请在设置中重新配置",
    EMPTY_RESPONSE: "翻译失败，请重试",
  };
  return map[code] ?? "翻译失败，请重试";
}

// ─── Feature 1: Selection tooltip ────────────────────────────────────────────

let selectionBtn = null;

document.addEventListener("mouseup", async (e) => {
  if (e.metaKey) return; // feature 2 territory
  const sel = window.getSelection();
  const text = sel?.toString().trim();
  console.log("[mini-translate] mouseup, selected text:", JSON.stringify(text));

  if (!text || text.length < 2) {
    // Don't clear immediately; let click-outside handler do it
    return;
  }

  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  selectionBtn = showTranslateBtn(rect);

  selectionBtn.addEventListener("click", async (ev) => {
    ev.stopPropagation();
    selectionBtn.textContent = "...";
    selectionBtn.disabled = true;

    const cached = cache.get(text);
    if (cached) {
      showTooltip(cached, rect);
      return;
    }

    const res = await sendTranslate(text);
    if (res?.result) {
      cache.set(text, res.result);
      showTooltip(res.result, rect);
    } else {
      showTooltip(errorMessage(res?.error), rect);
    }
  });
});

// Close tooltip / button on outside click or Escape
document.addEventListener("mousedown", (e) => {
  if (
    !e.target.classList.contains("mini-translate-btn") &&
    !e.target.classList.contains("mini-translate-tooltip")
  ) {
    removeAllTooltips();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") removeAllTooltips();
});

// ─── Feature 2: Command + hover highlight + click translate ──────────────────

const BLOCK_TAGS = new Set([
  "P", "LI", "TD", "TH", "BLOCKQUOTE",
  "H1", "H2", "H3", "H4", "H5", "H6",
  "ARTICLE", "SECTION", "DIV",
]);

function findTranslatable(el) {
  let node = el;
  while (node && node !== document.body) {
    if (
      BLOCK_TAGS.has(node.tagName) &&
      (node.innerText ?? "").trim().length > 20
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Meta") {
    cmdDown = true;
    console.log("[mini-translate] Command key down, hover-translate active");
    // Highlight element currently under mouse
    if (hoveredEl) applyHighlight(hoveredEl);
  }
});

document.addEventListener("keyup", (e) => {
  if (e.key === "Meta") {
    cmdDown = false;
    removeHighlight();
  }
});

document.addEventListener("mousemove", (e) => {
  if (!cmdDown) return;
  const el = findTranslatable(e.target);
  if (el !== highlightedEl) {
    removeHighlight();
    if (el) applyHighlight(el);
  }
  hoveredEl = e.target;
});

function applyHighlight(el) {
  el._mtOrigOutline = el.style.outline;
  el.style.outline = "2px solid #4A90E2";
  highlightedEl = el;
}

document.addEventListener("mousedown", async (e) => {
  if (!e.metaKey) return;

  const sel = window.getSelection();
  if (sel && sel.toString().trim().length > 1) return; // let feature 1 handle it

  const target = findTranslatable(e.target);
  if (!target) return;

  e.preventDefault(); // prevent text selection on click

  const text = (target.innerText ?? "").trim();
  if (!text) return;

  // Already translated
  const next = target.nextElementSibling;
  if (next && next.classList.contains("mini-translate-result") && !next.classList.contains("mini-translate-error")) {
    next.remove(); // toggle off
    return;
  }

  // Cached
  if (cache.has(text)) {
    showInlineResult(target, cache.get(text));
    return;
  }

  const loadingEl = showInlineLoading(target);
  const res = await sendTranslate(text);

  if (!loadingEl.isConnected) return; // user navigated away

  if (res?.result) {
    cache.set(text, res.result);
    loadingEl.remove();
    showInlineResult(target, res.result);
  } else {
    loadingEl.remove();
    showInlineError(target, errorMessage(res?.error));
    // Open popup if no key configured
    if (res?.error === "NO_KEY") {
      chrome.runtime.sendMessage({ type: "OPEN_POPUP" });
    }
  }
});
