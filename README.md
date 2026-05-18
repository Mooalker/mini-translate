# Mini Translate

极简 Chrome 翻译插件，Gemini 驱动。两个核心功能，零 npm 依赖。

## 功能

- **划词翻译** — 选中网页文字，点击浮现的「译」按钮，译文显示在气泡里
- **段落沉浸翻译** — 按住 `⌥ Option` 悬停段落，点击即把译文插入到原文正下方

## 安装

1. 克隆或下载此仓库
2. 打开 `chrome://extensions/`，开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」，选择本文件夹
4. 点击工具栏的插件图标 → 输入 Gemini API Key → 点「保存并验证」，显示「✓ 有效」即可

## 使用方法

### 划词翻译

1. 用鼠标选中网页上任意文字
2. 选区右上角浮现「译」按钮，点击它
3. 译文显示在白底气泡中；点击页面其他位置或按 `Esc` 关闭

### 段落沉浸翻译

1. 按住 `⌥ Option` 键，鼠标悬停到某个段落 —— 该段落出现蓝色描边
2. 保持 `⌥ Option`，点击该段落，译文以浅色块插入到原文正下方
3. 按住 `⌥ Option` 再次点击同一段落，可收起译文
4. 译文会一直保留，直到刷新页面

> 用 `⌥ Option`（而非 `⌘`）是为了避开浏览器「⌘+点击新标签打开」的冲突；点击链接段落时也不会跳转页面。

## 获取 API Key

前往 [Google AI Studio](https://aistudio.google.com/apikey)，登录 Google 账号，点击「Create API key」。

Gemini API 有免费层（约 1,500 次/天），但**免费层在部分国家/地区不可用**。若保存 key 时提示「无可用配额 / 需启用结算」，或翻译时报配额错误，说明该账号没有免费额度，需在 [Google Cloud Console](https://console.cloud.google.com/) 为对应项目启用结算（Billing）。`gemini-2.5-flash-lite` 付费层单价极低，日常使用通常每月仅几分钱到几毛钱。

## 常见问题

- **划词 / Option 都没反应** — 扩展重载后，内容脚本不会自动注入到已打开的标签页，刷新一下网页即可。`chrome://`、Chrome 应用商店、PDF 等页面禁止扩展注入脚本，属正常现象。
- **提示「请求过频」或「无可用配额」** — 多为配额或结算问题，见上方「获取 API Key」。
- **提示「无法连接 Google」** — Chrome 无法访问 `generativelanguage.googleapis.com`，检查代理 / VPN。

## 文件结构

```
mini-translate/
├── manifest.json     # MV3 配置
├── background.js     # Service Worker，处理 Gemini API 调用
├── content.js        # 核心逻辑：划词 + 段落翻译
├── popup.html        # 设置页
├── popup.js          # API Key 管理
└── styles.css        # 样式
```

## 翻译模型

`gemini-2.5-flash-lite` — 对混合技术/新闻/口语内容的翻译质量优于传统 NMT 引擎。

## 隐私说明

翻译时，选中或点击的文本会随你的 API Key 一并发送至 Google Gemini API 进行处理。插件不会上传任何其他数据，API Key 仅保存在本地浏览器。**请勿在网银、企业内部系统等敏感页面使用本插件。**

## 测试

E2E 测试基于 Playwright，真实加载扩展并模拟交互（划词、按键、网络 mock）。

```bash
npm install
npx playwright install chromium
npm test
```

覆盖：内容脚本注入、划词翻译、段落翻译与高亮、容器识别、点击拦截、错误提示、Key 验证、翻译缓存。

## License

MIT
