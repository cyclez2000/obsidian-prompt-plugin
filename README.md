# Prompt Capture（Obsidian 插件）

English: [README.en.md](./README.en.md)

在命令面板中用最短流程创建和整理提示词文件：输入标题即可新建，也可以后续统一管理、重命名和分类。

## 功能

- `新增提示词 / Add Prompt`
  - 只输入标题就创建 Markdown 文件
  - 自动写入 frontmatter
  - 创建后自动打开文件
- `管理提示词 / Manage Prompts`
  - 搜索现有提示词
  - 打开、重命名、改分类
  - 删除提示词
- 设置项
  - 自定义提示词根目录
  - 配置默认分类
  - 配置分类列表

## 使用方法

1. 打开命令面板（`Ctrl+P`）。
2. 执行 `新增提示词 / Add Prompt`。
3. 输入标题并按 `Enter`，或点击 `创建 / Create`。
4. 插件会自动创建并打开对应笔记。

如果要管理已有提示词，执行 `管理提示词 / Manage Prompts` 即可。

## 设置说明

- `Prompts root folder`
  - 例如 `Prompts` 或 `Assets/Prompts`
- `Default category`
  - 新提示词默认保存到这个分类
- `Category list`
  - 每行一个分类，插件会自动去重并保证默认分类可用

## 文件模板

新文件会自动写入以下 frontmatter：

```yaml
---
title: "你的标题"
category: "General"
created: 2026-03-03T00:00:00.000Z
---
```

当你后续重命名提示词或修改分类时，插件也会同步更新 `title` 和 `category` 字段。
