# Prompt Capture (Obsidian Plugin)

中文: [README.md](./README.md)

Create and organize prompt notes from the Command Palette with a minimal flow: type a title to create a note, then manage, rename, or recategorize it later.

## Features

- `新增提示词 / Add Prompt`
  - Create a Markdown note with title only
  - Automatically inserts frontmatter
  - Opens the file immediately after creation
- `管理提示词 / Manage Prompts`
  - Search existing prompt notes
  - Open, rename, and recategorize notes
  - Delete prompt notes
- Settings
  - Custom prompts root folder
  - Default category
  - Category list

## Usage

1. Open Command Palette (`Ctrl+P`).
2. Run `新增提示词 / Add Prompt`.
3. Enter a title and press `Enter`, or click `创建 / Create`.
4. The note is created and opened immediately.

To manage existing prompts, run `管理提示词 / Manage Prompts`.

## Settings

- `Prompts root folder`
  - Example: `Prompts` or `Assets/Prompts`
- `Default category`
  - New prompts are saved into this category by default
- `Category list`
  - One category per line; duplicates are removed automatically and the default category is kept valid

## File Template

New files include this frontmatter:

```yaml
---
title: "Your Title"
category: "General"
created: 2026-03-03T00:00:00.000Z
---
```

When a prompt is renamed or moved to another category, the plugin also updates the `title` and `category` frontmatter fields.
