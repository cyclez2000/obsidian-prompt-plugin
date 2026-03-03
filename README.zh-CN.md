# Prompt Capture（Obsidian 插件）

在命令面板中以最简流程新增提示词文件：只输入标题即可。

## 功能

- 命令面板入口：`新增提示词 / Add Prompt`
- 极简交互：仅输入标题
- 自动保存到：`<提示词根目录>/<默认分类>/<标题>.md`
- 自动创建不存在的目录
- 自动打开新建文件，立即继续编辑
- 分类和根目录可在插件设置中配置

## 使用方法

1. 打开命令面板（`Ctrl+P`）。
2. 执行 `新增提示词 / Add Prompt`。
3. 输入标题，按 `Enter`（或点击 `创建 / Create`）。
4. 文件会自动创建并打开。

## 设置项

- `Prompts root folder`：例如 `Prompts` 或 `Assets/Prompts`
- `Default category`：新建提示词默认落到该分类
- `Category list`：分类列表（每行一个）

## 新建文件模板

新文件会自动写入 frontmatter：

```yaml
---
title: "你的标题"
category: "General"
created: 2026-03-03T00:00:00.000Z
---
```

## English README

见 [README.md](./README.md)。

## 开发

```bash
npm install
npm run dev
```

- `npm run dev`：监听模式，代码变更后自动重建 `main.js`
- `npm run build`：一次性生产构建
- `npm run check`：TypeScript 类型检查

## 发布

1. 更新 `manifest.json` 和 `versions.json` 里的版本号。
2. 提交并推送到 `main`。
3. 创建并推送标签：

```bash
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions 会自动构建并上传：

- `manifest.json`
- `main.js`
- `styles.css`
