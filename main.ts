import {
	App,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	TFolder,
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

export default class PromptCapturePlugin extends Plugin {
	settings: PromptCaptureSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "add-prompt-entry",
			name: "新增提示词 / Add Prompt",
			callback: () => {
				new AddPromptTitleModal(this.app, this).open();
			},
		});

		this.addSettingTab(new PromptCaptureSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		if (!this.settings.categories || this.settings.categories.length === 0) {
			this.settings.categories = [...DEFAULT_SETTINGS.categories];
		}
		if (!this.settings.defaultCategory) {
			this.settings.defaultCategory = this.settings.categories[0] ?? "General";
		}
		if (!this.settings.categories.includes(this.settings.defaultCategory)) {
			this.settings.categories.unshift(this.settings.defaultCategory);
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async createPromptFile(title: string): Promise<TFile | null> {
		const safeTitle = sanitizeFileName(title);
		if (!safeTitle) {
			new Notice("Please input a valid title");
			return null;
		}

		const category = this.settings.defaultCategory.trim() || "General";
		const folderPath = normalizePath(`${this.settings.promptsFolder}/${category}`);
		await ensureFolder(this.app, folderPath);

		const filePath = normalizePath(`${folderPath}/${safeTitle}.md`);
		if (this.app.vault.getAbstractFileByPath(filePath)) {
			new Notice("A prompt with the same title already exists");
			return null;
		}

		const content = buildPromptTemplate(title, category);
		const file = await this.app.vault.create(filePath, content);
		new Notice(`Created: ${filePath}`);
		return file;
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
			.setDesc("仅需输入标题，文件将自动创建并打开")
			.addText((text) => {
				text.setPlaceholder("例如 / e.g. Security review prompt");
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

		const leaf = this.app.workspace.getLeaf(true);
		await leaf.openFile(file);
		this.close();
	}

	onClose() {
		this.contentEl.empty();
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
					this.plugin.settings.promptsFolder = value.trim() || "Prompts";
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Default category")
			.setDesc("New prompts will be saved to this category folder")
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
						const categories = value
							.split("\n")
							.map((v) => v.trim())
							.filter((v) => v.length > 0);
						this.plugin.settings.categories =
							categories.length > 0 ? categories : [...DEFAULT_SETTINGS.categories];
						if (!this.plugin.settings.categories.includes(this.plugin.settings.defaultCategory)) {
							this.plugin.settings.defaultCategory = this.plugin.settings.categories[0];
						}
						await this.plugin.saveSettings();
					}),
			);
	}
}

function buildPromptTemplate(title: string, category: string): string {
	const escapedTitle = title.replace(/"/g, '\\"');
	return `---\ntitle: "${escapedTitle}"\ncategory: "${category}"\ncreated: ${new Date().toISOString()}\n---\n\n`;
}

async function ensureFolder(app: App, folderPath: string): Promise<void> {
	const parts = folderPath.split("/");
	let current = "";
	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		const normalized = normalizePath(current);
		const existing = app.vault.getAbstractFileByPath(normalized);
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
