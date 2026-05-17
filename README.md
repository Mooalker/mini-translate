# Mini Translate

极简 Chrome 翻译插件，Gemini Flash 驱动。两个核心功能，零 npm 依赖。

## 功能

- **划词翻译**：选中文字 → 点击「译」按钮 → tooltip 显示翻译
- **段落沉浸翻译**：按住 `⌘ Command` + 点击段落 → 翻译结果显示在原文正下方

## 安装

1. 克隆或下载此仓库
2. 打开 `chrome://extensions/`，开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」，选择本文件夹
4. 点击插件图标 → 输入 Gemini API Key → 保存并验证

## 获取免费 API Key

前往 [Google AI Studio](https://aistudio.google.com/apikey)，登录 Google 账号，点击「Create API key」即可。全程免费，无需信用卡。

免费配额：1,500 次请求/天，个人日常使用完全够用。

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

`gemini-2.0-flash-lite` — 对混合技术/新闻/口语内容的翻译质量优于传统 NMT 引擎。

## License

MIT
