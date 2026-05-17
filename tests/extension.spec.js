const { test, expect } = require("./fixtures");

const PAGE = "http://localhost:8123/test-page.html";
const MOCK_TRANSLATION = "【模拟翻译】这是一段测试译文。";

function mockBody() {
  return JSON.stringify({
    candidates: [{ content: { parts: [{ text: MOCK_TRANSLATION }] } }],
  });
}

async function setApiKey(context, extensionId, key) {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.evaluate((k) => chrome.storage.local.set({ apiKey: k }), key);
  await popup.close();
}

async function mockGemini(context) {
  await context.route("**/generativelanguage.googleapis.com/**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: mockBody(),
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────

test("content script 注入页面", async ({ context }) => {
  const page = await context.newPage();
  const logs = [];
  page.on("console", (msg) => logs.push(msg.text()));
  await page.goto(PAGE);
  await page.waitForTimeout(600);
  expect(logs.some((l) => l.includes("content script loaded"))).toBeTruthy();
});

test("划词后出现翻译按钮", async ({ context }) => {
  const page = await context.newPage();
  await page.goto(PAGE);
  await page.waitForTimeout(400);
  await page.dblclick("#word");
  await expect(page.locator(".mini-translate-btn")).toBeVisible({
    timeout: 3000,
  });
});

test("划词翻译完整流程：点击按钮 → tooltip 显示译文", async ({
  context,
  extensionId,
}) => {
  await setApiKey(context, extensionId, "test-key");
  await mockGemini(context);
  const page = await context.newPage();
  await page.goto(PAGE);
  await page.waitForTimeout(400);
  await page.dblclick("#word");
  await page.locator(".mini-translate-btn").click();
  const tip = page.locator(".mini-translate-tooltip");
  await expect(tip).toBeVisible({ timeout: 5000 });
  await expect(tip).toContainText("模拟翻译");
});

test("按住 Option 悬停高亮段落", async ({ context }) => {
  const page = await context.newPage();
  await page.goto(PAGE);
  await page.waitForTimeout(400);
  const box = await page.locator("#para1").boundingBox();
  await page.keyboard.down("Alt");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
  const outline = await page
    .locator("#para1")
    .evaluate((el) => el.style.outline);
  await page.keyboard.up("Alt");
  expect(outline).toContain("solid");
  expect(outline).toContain("2px");
});

test("Option + 点击段落：翻译结果显示在原文下方", async ({
  context,
  extensionId,
}) => {
  await setApiKey(context, extensionId, "test-key");
  await mockGemini(context);
  const page = await context.newPage();
  await page.goto(PAGE);
  await page.waitForTimeout(400);
  const box = await page.locator("#para1").boundingBox();
  await page.keyboard.down("Alt");
  await page.mouse.move(box.x + 30, box.y + 12);
  await page.mouse.down();
  await page.mouse.up();
  await page.keyboard.up("Alt");
  const result = page.locator(".mini-translate-result");
  await expect(result).toBeVisible({ timeout: 5000 });
  await expect(result).toContainText("模拟翻译");
});

test("未配置 API Key 时显示错误提示", async ({ context }) => {
  // Fresh context = empty storage = no key
  const page = await context.newPage();
  await page.goto(PAGE);
  await page.waitForTimeout(400);
  const box = await page.locator("#para2").boundingBox();
  await page.keyboard.down("Alt");
  await page.mouse.move(box.x + 30, box.y + 12);
  await page.mouse.down();
  await page.mouse.up();
  await page.keyboard.up("Alt");
  const err = page.locator(".mini-translate-error");
  await expect(err).toBeVisible({ timeout: 5000 });
  await expect(err).toContainText("API Key");
});

test("翻译缓存：相同段落不重复请求 API", async ({
  context,
  extensionId,
}) => {
  await setApiKey(context, extensionId, "test-key");
  let apiCalls = 0;
  await context.route("**/generativelanguage.googleapis.com/**", (route) => {
    apiCalls++;
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: mockBody(),
    });
  });

  const page = await context.newPage();
  await page.goto(PAGE);
  await page.waitForTimeout(400);
  const box = await page.locator("#para1").boundingBox();
  const cx = box.x + 30;
  const cy = box.y + 12;

  await page.keyboard.down("Alt");

  // 1st translate → API call
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.locator(".mini-translate-result")).toBeVisible({
    timeout: 5000,
  });

  // 2nd click → toggle off (result removed)
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.locator(".mini-translate-result")).toHaveCount(0);

  // 3rd click → re-translate, should hit cache (no new API call)
  await page.mouse.down();
  await page.mouse.up();
  await page.keyboard.up("Alt");
  await expect(page.locator(".mini-translate-result")).toBeVisible({
    timeout: 5000,
  });

  expect(apiCalls).toBe(1);
});
