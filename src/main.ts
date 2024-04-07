import {
	App,
	Editor,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";
import { ChatModal, ImageModal, PromptModal, SpeechModal } from "./modal";
import { OpenAIAssistant, OpenAIModels } from "./openai_api";
import { CohereAIAssistant, CohereModels } from "./cohere_api";

interface SettingTab {
	models: { [key: string]: string };
	imgModels: { [key: string]: string };
}

interface Settings {
	provider: string;
}

interface AiAssistantSettings {
	mySetting: string;
	provider: string;
	apiKey: string;
	modelName: string;
	imageModelName: string;
	maxTokens: number;
	replaceSelection: boolean;
	imgFolder: string;
	language: string;
}

const DEFAULT_SETTINGS: AiAssistantSettings = {
	mySetting: "default",
	apiKey: "",
	provider: "",
	modelName: "gpt-3.5-turbo",
	imageModelName: "dall-e-3",
	maxTokens: 500,
	replaceSelection: true,
	imgFolder: "AiAssistant/Assets",
	language: "",
};

export default class AiAssistantPlugin extends Plugin {
	settings: AiAssistantSettings;
	openai: OpenAIAssistant;
	model: OpenAIAssistant | CohereAIAssistant;

	build_api() {
		switch (this.settings.provider) {
			case "openai":
				this.model = new OpenAIAssistant(
					this.settings.apiKey,
					this.settings.modelName,
					this.settings.maxTokens,
				);
				break;
			case "cohere":
				this.model = new CohereAIAssistant(
					this.settings.apiKey,
					this.settings.modelName,
					this.settings.maxTokens,
				);
				break;
			default:
				new Notice("Provider not supported!");
				break;
		}

		this.openai = new OpenAIAssistant(
			this.settings.apiKey,
			this.settings.modelName,
			this.settings.maxTokens,
		);
	}

	async onload() {
		await this.loadSettings();
		this.build_api();

		this.addCommand({
			id: "chat-mode",
			name: "Open Assistant Chat",
			callback: () => {
				new ChatModal(this.app, this.model).open();
			},
		});

		this.addCommand({
			id: "prompt-mode",
			name: "Open Assistant Prompt",
			editorCallback: async (editor: Editor) => {
				const selected_text = editor.getSelection().toString().trim();
				new PromptModal(
					this.app,
					async (x: { [key: string]: string }) => {
						// had to define any here because I ran into a weird scope issue when defining the variable in the if/else statement
						let answer: any;
						if (this.model.name == "openai") {
							answer = await this.model.api_call([
								{
									role: "user",
									content:
										x["prompt_text"] +
										" : " +
										selected_text,
								},
							]);
						} else {
							answer = await this.model.api_call(
								x["prompt_text"],
								selected_text,
							);
						}
						if (!this.settings.replaceSelection) {
							answer = selected_text + "\n" + answer.trim();
						}
						if (answer) {
							editor.replaceSelection(answer.trim());
						}
					},
					false,
					{},
				).open();
			},
		});

		this.addCommand({
			id: "img-generator",
			name: "Open Image Generator",
			editorCallback: async (editor: Editor) => {
				new PromptModal(
					this.app,
					async (prompt: { [key: string]: string }) => {
						const answer = await this.openai.img_api_call(
							this.settings.imageModelName,
							prompt["prompt_text"],
							prompt["img_size"],
							parseInt(prompt["num_img"]),
							prompt["is_hd"] === "true",
						);
						if (answer) {
							const imageModal = new ImageModal(
								this.app,
								answer,
								prompt["prompt_text"],
								this.settings.imgFolder,
							);
							imageModal.open();
						}
					},
					true,
					{ model: this.settings.imageModelName },
				).open();
			},
		});

		this.addCommand({
			id: "speech-to-text",
			name: "Open Speech to Text",
			editorCallback: (editor: Editor) => {
				new SpeechModal(
					this.app,
					this.openai,
					this.settings.language,
					editor,
				).open();
			},
		});

		this.addSettingTab(new AiAssistantSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class AiAssistantSettingTab extends PluginSettingTab {
	plugin: AiAssistantPlugin;
	setting_tab: SettingTab;

	constructor(app: App, plugin: AiAssistantPlugin) {
		super(app, plugin);
		this.plugin = plugin;

		switch (this.plugin.settings.provider) {
			case "openai":
				this.setting_tab = OpenAIModels;
				break;
			case "cohere":
				this.setting_tab = CohereModels;
				break;
			default:
				new Notice("Provider not supported");
				break;
		}
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.createEl("h2", { text: "Settings for my AI assistant." });

		new Setting(containerEl)
			.setName("Provider")
			.setDesc("Select your provider")
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						openai: "OpenAI",
						cohere: "Cohere",
					})
					.setValue(this.plugin.settings.provider)
					.onChange(async (value) => {
						// save the current settings
						await this.plugin.saveSettings();

						// load the new settings
						this.plugin.settings.provider = value;

						switch (value) {
							case "openai":
								this.setting_tab = OpenAIModels;
								break;
							case "cohere":
								this.setting_tab = CohereModels;
								break;
							default:
								new Notice("Provider not supported");
								break;
						}

						// console.log(this.setting_tab);

						this.plugin.build_api();
						// fresh the setting tab
						this.display();
					}),
			);

		new Setting(containerEl).setName("API Key").addText((text) =>
			text
				.setPlaceholder("Enter your key here")
				.setValue(this.plugin.settings.apiKey)
				.onChange(async (value) => {
					this.plugin.settings.apiKey = value;
					await this.plugin.saveSettings();
					this.plugin.build_api();
				}),
		);
		containerEl.createEl("h3", { text: "Text Assistant" });

		new Setting(containerEl)
			.setName("Model Name")
			.setDesc("Select your model")
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(this.setting_tab.models)
					.setValue(this.plugin.settings.modelName)
					.onChange(async (value) => {
						this.plugin.settings.modelName = value;
						await this.plugin.saveSettings();
						this.plugin.build_api();
					}),
			);

		new Setting(containerEl)
			.setName("Max Tokens")
			.setDesc("Select max number of generated tokens")
			.addText((text) =>
				text
					.setPlaceholder("Max tokens")
					.setValue(this.plugin.settings.maxTokens.toString())
					.onChange(async (value) => {
						const int_value = parseInt(value);
						if (!int_value || int_value <= 0) {
							new Notice("Error while parsing maxTokens ");
						} else {
							this.plugin.settings.maxTokens = int_value;
							await this.plugin.saveSettings();
							this.plugin.build_api();
						}
					}),
			);

		new Setting(containerEl)
			.setName("Prompt behavior")
			.setDesc("Replace selection")
			.addToggle((toogle) => {
				toogle
					.setValue(this.plugin.settings.replaceSelection)
					.onChange(async (value) => {
						this.plugin.settings.replaceSelection = value;
						await this.plugin.saveSettings();
						this.plugin.build_api();
					});
			});
		containerEl.createEl("h3", { text: "Image Assistant" });
		new Setting(containerEl)
			.setName("Default location for generated images")
			.setDesc("Where generated images are stored.")
			.addText((text) =>
				text
					.setPlaceholder("Enter the path to you image folder")
					.setValue(this.plugin.settings.imgFolder)
					.onChange(async (value) => {
						const path = value.replace(/\/+$/, "");
						if (path) {
							this.plugin.settings.imgFolder = path;
							await this.plugin.saveSettings();
						} else {
							new Notice("Image folder cannot be empty");
						}
					}),
			);
		new Setting(containerEl)
			.setName("Image Model Name")
			.setDesc("Select your model")
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(this.setting_tab.imgModels)
					.setValue(this.plugin.settings.imageModelName)
					.onChange(async (value) => {
						this.plugin.settings.imageModelName = value;
						await this.plugin.saveSettings();
						this.plugin.build_api();
					}),
			);

		containerEl.createEl("h3", { text: "Speech to Text" });
		new Setting(containerEl)
			.setName("The language of the input audio")
			.setDesc("Using ISO-639-1 format (en, fr, de, ...)")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.language)
					.onChange(async (value) => {
						this.plugin.settings.language = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
