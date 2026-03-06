import {
	App,
	FuzzySuggestModal,
	ItemView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TAbstractFile,
	TFile,
	TFolder,
	WorkspaceLeaf,
	normalizePath,
} from "obsidian";

interface PromptCaptureSettings {
	promptsFolder: string;
	categories: string[];
	defaultCategory: string;
}

const DEFAULT_SETTINGS: PromptCaptureSettings = {
	promptsFolder: "Prompts",
	categories: ["General", "Coding", "Writing"],
	defaultCategory: "General",
};

const PROMPT_EXECUTION_VIEW_TYPE = "prompt-execution-view";

export default class PromptCapturePlugin extends Plugin {
	settings!: PromptCaptureSettings;
	private refreshTimer: number | null = null;

	async onload() {
		await this.loadSettings();

		this.registerView(
			PROMPT_EXECUTION_VIEW_TYPE,
			(leaf) => new PromptExecutionView(leaf, this),
		);

		this.addCommand({
			id: "add-prompt-entry",
			name: "新增提示词 / Add Prompt",
			callback: () => {
				new AddPromptTitleModal(this.app, this).open();
			},
		});

		this.addCommand({
			id: "manage-prompts",
			name: "管理提示词 / Manage Prompts",
			callback: () => {
				if (this.getPromptFiles().length === 0) {
					new Notice("未找到提示词文件 / No prompt files found");
					return;
				}
				new PromptPickerModal(this.app, this).open();
			},
		});

		this.addCommand({
			id: "open-prompt-execution-view",
			name: "打开提示词侧边栏 / Open Prompt Sidebar",
			callback: () => {
				void this.activatePromptExecutionView();
			},
		});

		this.addRibbonIcon("panel-right-open", "Open Prompt Sidebar", () => {
			void this.activatePromptExecutionView();
		});

		this.registerEvent(
			this.app.vault.on("create", (file) => {
				if (file instanceof TFile && this.isPromptFile(file)) {
					this.requestPromptViewRefresh();
				}
			}),
		);

		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (file instanceof TFile && this.isPromptPath(file.path)) {
					this.requestPromptViewRefresh();
				}
			}),
		);

		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (
					file instanceof TFile &&
					(this.isPromptFile(file) || this.isPromptPath(oldPath))
				) {
					this.requestPromptViewRefresh();
				}
			}),
		);

		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (file instanceof TFile && this.isPromptFile(file)) {
					this.requestPromptViewRefresh();
				}
			}),
		);

		this.register(() => {
			if (this.refreshTimer !== null) {
				window.clearTimeout(this.refreshTimer);
			}
		});

		this.addSettingTab(new PromptCaptureSettingTab(this.app, this));
		this.app.workspace.onLayoutReady(() => {
			this.requestPromptViewRefresh();
		});
	}

	async onunload() {
		if (this.refreshTimer !== null) {
			window.clearTimeout(this.refreshTimer);
		}
		await this.app.workspace.detachLeavesOfType(PROMPT_EXECUTION_VIEW_TYPE);
	}

	async loadSettings() {
		const loadedSettings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.settings = normalizeSettings(loadedSettings);
	}

	async saveSettings() {
		this.settings = normalizeSettings(this.settings);
		await this.saveData(this.settings);
		this.requestPromptViewRefresh();
	}

	getPromptFiles(): TFile[] {
		return this.app.vault
			.getMarkdownFiles()
			.filter((file) => this.isPromptPath(file.path))
			.sort((a, b) => a.path.localeCompare(b.path));
	}

	getPromptCategory(file: TFile): string {
		const root = normalizePath(this.settings.promptsFolder);
		const parentPath = file.parent?.path ?? "";
		if (parentPath === root) {
			return "";
		}

		const prefix = `${root}/`;
		if (parentPath.startsWith(prefix)) {
			return parentPath.slice(prefix.length);
		}

		return "";
	}

	isPromptFile(file: TFile): boolean {
		return this.isPromptPath(file.path);
	}

	isPromptPath(path: string): boolean {
		const root = normalizePath(this.settings.promptsFolder);
		return path.startsWith(`${root}/`);
	}

	async createPromptFile(title: string): Promise<TFile | null> {
		const safeTitle = sanitizeFileName(title);
		if (!safeTitle) {
			new Notice("请输入有效标题 / Please input a valid title");
			return null;
		}

		const category = this.settings.defaultCategory.trim() || DEFAULT_SETTINGS.defaultCategory;
		const folderPath = normalizePath(`${this.settings.promptsFolder}/${category}`);

		try {
			await ensureFolder(this.app, folderPath);

			const filePath = normalizePath(`${folderPath}/${safeTitle}.md`);
			if (this.app.vault.getAbstractFileByPath(filePath)) {
				new Notice("同名文件已存在 / Same title already exists");
				return null;
			}

			const content = buildPromptTemplate(title, category);
			const file = await this.app.vault.create(filePath, content);
			this.requestPromptViewRefresh();
			new Notice(`已创建 / Created: ${filePath}`);
			return file;
		} catch (error) {
			console.error("Failed to create prompt file", error);
			new Notice("创建失败，请检查目录设置 / Failed to create prompt file");
			return null;
		}
	}

	async moveOrRenamePrompt(file: TFile, title: string, category: string): Promise<boolean> {
		const safeTitle = sanitizeFileName(title);
		if (!safeTitle) {
			new Notice("请输入有效标题 / Please input a valid title");
			return false;
		}

		const normalizedCategory = category.trim();
		const targetFolder = normalizedCategory
			? normalizePath(`${this.settings.promptsFolder}/${normalizedCategory}`)
			: normalizePath(this.settings.promptsFolder);

		try {
			await ensureFolder(this.app, targetFolder);

			const targetPath = normalizePath(`${targetFolder}/${safeTitle}.md`);
			if (targetPath !== file.path && this.app.vault.getAbstractFileByPath(targetPath)) {
				new Notice("目标路径已存在同名文件 / Target file already exists");
				return false;
			}

			if (targetPath !== file.path) {
				await this.app.fileManager.renameFile(file, targetPath);
			}

			const updatedFile = this.app.vault.getAbstractFileByPath(targetPath);
			if (!(updatedFile instanceof TFile)) {
				throw new Error(`Prompt file not found after rename: ${targetPath}`);
			}

			await syncPromptFrontmatter(this.app, updatedFile, title, normalizedCategory);
			this.requestPromptViewRefresh();
			new Notice(`已更新 / Updated: ${targetPath}`);
			return true;
		} catch (error) {
			console.error("Failed to move or rename prompt", error);
			new Notice("保存失败，请检查路径或文件状态 / Failed to update prompt");
			return false;
		}
	}

	async deletePrompt(file: TFile): Promise<void> {
		try {
			await this.app.vault.trash(file, true);
			this.requestPromptViewRefresh();
			new Notice("已删除 / Deleted");
		} catch (error) {
			console.error("Failed to delete prompt", error);
			new Notice("删除失败 / Failed to delete prompt");
		}
	}

	async openPrompt(file: TFile) {
		const leaf = this.app.workspace.getLeaf(true);
		await leaf.openFile(file);
	}

	async copyPrompt(file: TFile) {
		try {
			const content = await this.app.vault.cachedRead(file);
			const prompt = extractPromptBody(content).trim();
			if (!prompt) {
				new Notice("提示词内容为空 / Prompt content is empty");
				return;
			}

			await copyTextToClipboard(prompt);
			new Notice(`已复制提示词 / Copied: ${file.basename}`);
		} catch (error) {
			console.error("Failed to copy prompt", error);
			new Notice("复制失败 / Failed to copy prompt");
		}
	}

	requestPromptViewRefresh() {
		if (this.refreshTimer !== null) {
			window.clearTimeout(this.refreshTimer);
		}

		this.refreshTimer = window.setTimeout(() => {
			this.refreshTimer = null;
			void this.refreshPromptViews();
		}, 80);
	}

	async refreshPromptViews() {
		for (const leaf of this.app.workspace.getLeavesOfType(PROMPT_EXECUTION_VIEW_TYPE)) {
			const view = leaf.view;
			if (view instanceof PromptExecutionView) {
				await view.refresh();
			}
		}
	}

	async activatePromptExecutionView() {
		let leaf: WorkspaceLeaf | null | undefined =
			this.app.workspace.getLeavesOfType(PROMPT_EXECUTION_VIEW_TYPE)[0];

		if (!leaf) {
			leaf = this.app.workspace.getRightLeaf(false);
			if (!leaf) {
				new Notice("无法打开侧边栏 / Unable to open sidebar");
				return;
			}
			await leaf.setViewState({
				type: PROMPT_EXECUTION_VIEW_TYPE,
				active: true,
			});
		}

		this.app.workspace.revealLeaf(leaf);
		await this.refreshPromptViews();
	}
}

class AddPromptTitleModal extends Modal {
	private plugin: PromptCapturePlugin;
	private titleValue = "";

	constructor(app: App, plugin: PromptCapturePlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "新增提示词 / Add Prompt" });

		new Setting(contentEl)
			.setName("标题 / Title")
			.setDesc("只需输入标题，文件会自动创建并打开")
			.addText((text) => {
				text.setPlaceholder("例如 / e.g. Security review prompt");
				window.setTimeout(() => text.inputEl.focus(), 0);
				text.inputEl.addEventListener("keydown", async (event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						await this.submit();
					}
				});
				text.onChange((value) => {
					this.titleValue = value.trim();
				});
			});

		new Setting(contentEl).addButton((button) =>
			button
				.setButtonText("创建 / Create")
				.setCta()
				.onClick(async () => {
					await this.submit();
				}),
		);
	}

	private async submit() {
		if (!this.titleValue) {
			new Notice("请输入标题 / Please input title");
			return;
		}

		const file = await this.plugin.createPromptFile(this.titleValue);
		if (!file) {
			return;
		}

		await this.plugin.openPrompt(file);
		this.close();
	}

	onClose() {
		this.contentEl.empty();
	}
}

class PromptPickerModal extends FuzzySuggestModal<TFile> {
	private plugin: PromptCapturePlugin;

	constructor(app: App, plugin: PromptCapturePlugin) {
		super(app);
		this.plugin = plugin;
		this.setPlaceholder("选择一个提示词进行管理 / Pick a prompt to manage");
	}

	getItems(): TFile[] {
		return this.plugin.getPromptFiles();
	}

	getItemText(item: TFile): string {
		return item.basename;
	}

	renderSuggestion(item: { item: TFile }, el: HTMLElement): void {
		const title = el.createDiv();
		title.setText(item.item.basename);
		title.addClass("prompt-picker-title");

		const meta = el.createDiv();
		const category = this.plugin.getPromptCategory(item.item) || "(root)";
		meta.setText(`${category}  |  ${item.item.path}`);
		meta.addClass("prompt-picker-meta");
	}

	onChooseItem(item: TFile): void {
		new PromptManageModal(this.app, this.plugin, item).open();
	}
}

class PromptManageModal extends Modal {
	private plugin: PromptCapturePlugin;
	private file: TFile;
	private titleValue: string;
	private categoryValue: string;

	constructor(app: App, plugin: PromptCapturePlugin, file: TFile) {
		super(app);
		this.plugin = plugin;
		this.file = file;
		this.titleValue = file.basename;
		this.categoryValue = plugin.getPromptCategory(file);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "管理提示词 / Manage Prompt" });

		new Setting(contentEl).setName("当前文件 / Current").setDesc(this.file.path);

		new Setting(contentEl)
			.setName("标题 / Title")
			.addText((text) => {
				text.setValue(this.titleValue);
				text.onChange((value) => {
					this.titleValue = value.trim();
				});
			});

		new Setting(contentEl)
			.setName("分类 / Category")
			.setDesc("修改分类时会将文件移动到对应目录")
			.addText((text) => {
				text.setValue(this.categoryValue);
				text.setPlaceholder("例如 / e.g. Coding");
				text.onChange((value) => {
					this.categoryValue = value.trim();
				});
			});

		new Setting(contentEl)
			.addButton((button) =>
				button.setButtonText("打开 / Open").onClick(async () => {
					await this.plugin.openPrompt(this.file);
					this.close();
				}),
			)
			.addButton((button) =>
				button
					.setButtonText("保存修改 / Save")
					.setCta()
					.onClick(async () => {
						const changed = await this.plugin.moveOrRenamePrompt(
							this.file,
							this.titleValue,
							this.categoryValue,
						);
						if (!changed) {
							return;
						}

						const newPath = buildTargetPath(
							this.plugin.settings.promptsFolder,
							this.titleValue,
							this.categoryValue,
						);
						const updatedFile = this.app.vault.getAbstractFileByPath(newPath);
						if (updatedFile instanceof TFile) {
							this.file = updatedFile;
						}
						this.close();
					}),
			)
			.addButton((button) =>
				button
					.setWarning()
					.setButtonText("删除 / Delete")
					.onClick(async () => {
						await this.plugin.deletePrompt(this.file);
						this.close();
					}),
			);
	}
}

class PromptExecutionView extends ItemView {
	private plugin: PromptCapturePlugin;
	private query = "";
	private searchInputEl: HTMLInputElement | null = null;
	private statsEl: HTMLElement | null = null;
	private listEl: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: PromptCapturePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return PROMPT_EXECUTION_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Prompt Sidebar";
	}

	getIcon(): string {
		return "panel-right-open";
	}

	async onOpen() {
		this.contentEl.empty();
		this.contentEl.addClass("prompt-execution-view");

		const headerEl = this.contentEl.createDiv({ cls: "prompt-execution-header" });
		headerEl.createEl("h2", {
			text: "Prompt Sidebar",
			cls: "prompt-execution-title",
		});

		this.statsEl = headerEl.createDiv({ cls: "prompt-execution-stats" });

		this.searchInputEl = this.contentEl.createEl("input", {
			type: "search",
			placeholder: "搜索标题或分类 / Search prompts",
			cls: "prompt-execution-search",
		});
		this.searchInputEl.value = this.query;
		this.searchInputEl.addEventListener("input", () => {
			this.query = this.searchInputEl?.value.trim() ?? "";
			void this.refresh();
		});

		this.listEl = this.contentEl.createDiv({ cls: "prompt-execution-list" });
		await this.refresh();
	}

	async refresh() {
		if (!this.listEl || !this.statsEl) {
			return;
		}

		const files = this.filterPromptFiles(this.plugin.getPromptFiles());
		this.statsEl.setText(`${files.length} prompts`);
		this.listEl.empty();

		if (files.length === 0) {
			const emptyEl = this.listEl.createDiv({ cls: "prompt-execution-empty" });
			emptyEl.createEl("strong", {
				text: this.query ? "没有匹配的提示词" : "还没有提示词",
			});
			emptyEl.createDiv({
				text: this.query
					? "换个关键词试试，或清空搜索条件。"
					: "使用“新增提示词 / Add Prompt”命令开始创建。",
			});
			return;
		}

		for (const file of files) {
			const itemEl = this.listEl.createDiv({ cls: "prompt-execution-item" });

			const bodyEl = itemEl.createDiv({ cls: "prompt-execution-item-body" });
			bodyEl.addEventListener("click", () => {
				void this.plugin.copyPrompt(file);
			});

			bodyEl.createDiv({
				text: file.basename,
				cls: "prompt-execution-item-title",
			});

			const metaParts = [this.plugin.getPromptCategory(file) || "Uncategorized", file.path];
			bodyEl.createDiv({
				text: metaParts.join("  |  "),
				cls: "prompt-execution-item-meta",
			});

			const actionsEl = itemEl.createDiv({ cls: "prompt-execution-actions" });

			const copyButton = actionsEl.createEl("button", {
				text: "复制",
				cls: "prompt-execution-button mod-cta",
			});
			copyButton.addEventListener("click", (event) => {
				event.stopPropagation();
				void this.plugin.copyPrompt(file);
			});

			const openButton = actionsEl.createEl("button", {
				text: "打开",
				cls: "prompt-execution-button",
			});
			openButton.addEventListener("click", (event) => {
				event.stopPropagation();
				void this.plugin.openPrompt(file);
			});
		}
	}

	private filterPromptFiles(files: TFile[]): TFile[] {
		const query = this.query.toLocaleLowerCase();
		if (!query) {
			return files;
		}

		return files.filter((file) => {
			const haystacks = [
				file.basename,
				file.path,
				this.plugin.getPromptCategory(file),
			];
			return haystacks.some((value) => value.toLocaleLowerCase().includes(query));
		});
	}
}

class PromptCaptureSettingTab extends PluginSettingTab {
	plugin: PromptCapturePlugin;

	constructor(app: App, plugin: PromptCapturePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Prompts root folder")
			.setDesc("Example: Prompts or Assets/Prompts")
			.addText((text) =>
				text.setValue(this.plugin.settings.promptsFolder).onChange(async (value) => {
					this.plugin.settings.promptsFolder = normalizePromptsFolder(value);
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Default category")
			.setDesc("New prompts are saved to this category")
			.addDropdown((dropdown) => {
				for (const category of this.plugin.settings.categories) {
					dropdown.addOption(category, category);
				}
				dropdown.setValue(this.plugin.settings.defaultCategory);
				dropdown.onChange(async (value) => {
					this.plugin.settings.defaultCategory = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Category list")
			.setDesc("One category per line")
			.addTextArea((textArea) =>
				textArea
					.setValue(this.plugin.settings.categories.join("\n"))
					.onChange(async (value) => {
						this.plugin.settings.categories = value.split("\n");
						await this.plugin.saveSettings();
					}),
			);
	}
}

function buildPromptTemplate(title: string, category: string): string {
	return `---\ntitle: ${yamlString(title)}\ncategory: ${yamlString(category)}\ncreated: ${new Date().toISOString()}\n---\n\n`;
}

function buildTargetPath(root: string, title: string, category: string): string {
	const safeTitle = sanitizeFileName(title);
	const targetFolder = category.trim() ? `${root}/${category.trim()}` : root;
	return normalizePath(`${targetFolder}/${safeTitle}.md`);
}

async function ensureFolder(app: App, folderPath: string): Promise<void> {
	const parts = folderPath.split("/");
	let current = "";

	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		const normalized = normalizePath(current);
		const existing: TAbstractFile | null = app.vault.getAbstractFileByPath(normalized);
		if (!existing) {
			await app.vault.createFolder(normalized);
		} else if (!(existing instanceof TFolder)) {
			throw new Error(`${normalized} exists but is not a folder`);
		}
	}
}

function sanitizeFileName(name: string): string {
	return name.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim();
}

function normalizePromptsFolder(folder: string): string {
	return normalizePath(folder.trim() || DEFAULT_SETTINGS.promptsFolder);
}

function normalizeSettings(settings: PromptCaptureSettings): PromptCaptureSettings {
	const promptsFolder = normalizePromptsFolder(settings.promptsFolder);
	const defaultCategory = settings.defaultCategory.trim() || DEFAULT_SETTINGS.defaultCategory;
	const categories = dedupeCategories([...settings.categories, defaultCategory]);

	return {
		promptsFolder,
		categories: categories.length > 0 ? categories : [...DEFAULT_SETTINGS.categories],
		defaultCategory: categories.includes(defaultCategory) ? defaultCategory : categories[0] ?? "General",
	};
}

function dedupeCategories(categories: string[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];

	for (const category of categories) {
		const normalized = category.trim();
		if (!normalized || seen.has(normalized)) {
			continue;
		}
		seen.add(normalized);
		result.push(normalized);
	}

	return result;
}

function yamlString(value: string): string {
	return JSON.stringify(value);
}

function extractPromptBody(content: string): string {
	return content.replace(/^---\n[\s\S]*?\n---\n?/u, "");
}

async function copyTextToClipboard(text: string): Promise<void> {
	if (navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(text);
		return;
	}

	const textArea = document.createElement("textarea");
	textArea.value = text;
	textArea.style.position = "fixed";
	textArea.style.opacity = "0";
	document.body.appendChild(textArea);
	textArea.focus();
	textArea.select();
	document.execCommand("copy");
	document.body.removeChild(textArea);
}

async function syncPromptFrontmatter(
	app: App,
	file: TFile,
	title: string,
	category: string,
): Promise<void> {
	const content = await app.vault.cachedRead(file);
	const nextTitleLine = `title: ${yamlString(title)}`;
	const nextCategoryLine = `category: ${yamlString(category)}`;
	const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?/;

	if (!frontmatterRegex.test(content)) {
		const frontmatter = `---\n${nextTitleLine}\n${nextCategoryLine}\n---\n\n`;
		await app.vault.modify(file, `${frontmatter}${content}`);
		return;
	}

	const nextContent = content.replace(frontmatterRegex, (_match, rawFrontmatter: string) => {
		const lines = rawFrontmatter.split("\n");
		let hasTitle = false;
		let hasCategory = false;

		const updatedLines = lines.map((line) => {
			if (/^title:\s*/u.test(line)) {
				hasTitle = true;
				return nextTitleLine;
			}
			if (/^category:\s*/u.test(line)) {
				hasCategory = true;
				return nextCategoryLine;
			}
			return line;
		});

		if (!hasTitle) {
			updatedLines.push(nextTitleLine);
		}
		if (!hasCategory) {
			updatedLines.push(nextCategoryLine);
		}

		return `---\n${updatedLines.join("\n")}\n---\n`;
	});

	await app.vault.modify(file, nextContent);
}
