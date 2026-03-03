# Prompt Capture (Obsidian Plugin)

Create prompt files from Command Palette with only one input: title.

## Features

- Command Palette entry: `新增提示词 / Add Prompt`
- Minimal flow: input title only
- Auto save to: `<Prompts Root>/<Default Category>/<Title>.md`
- Auto create missing folders
- Auto open the newly created file for editing
- Category and folder configurable in plugin settings

## Usage

1. Open Command Palette (`Ctrl+P`).
2. Run `新增提示词 / Add Prompt`.
3. Input title and press `Enter` (or click `创建 / Create`).
4. The note is created and opened immediately.

## Settings

- `Prompts root folder`: e.g. `Prompts` or `Assets/Prompts`
- `Default category`: target folder for new prompt files
- `Category list`: available categories (one per line)

## File Template

New files include frontmatter:

```yaml
---
title: "Your Title"
category: "General"
created: 2026-03-03T00:00:00.000Z
---
```

## Chinese README

See [README.zh-CN.md](./README.zh-CN.md).

## Release

1. Update `manifest.json` version and `versions.json`.
2. Commit and push to `main`.
3. Create and push a tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The GitHub Actions workflow will build and upload:

- `manifest.json`
- `main.js`
- `styles.css`
