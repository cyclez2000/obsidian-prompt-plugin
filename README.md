# Prompt Capture（Obsidian 插件）

在命令面板中以最简流程新增提示词文件：只输入标题即可。

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
