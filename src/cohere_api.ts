import { CohereClient } from "cohere-ai";
import { MarkdownRenderer, MarkdownView, Notice } from "obsidian";

export const CohereModels = {
	models: {
		"command-light": "command-light",
		"command-light-nightly": "command-light-nightly",
		comand: "command",
		"command-nightly": "command-nightly",
		"command-r": "command-r",
		"command-r-plus": "command-r-plus",
	},
	imgModels: {},
};

export class CohereAIAssistant {
	modelName: string;
	cohere: CohereClient;
	maxTokens: number;
	apiKey: string;
	name: "cohere";

	constructor(apiKey: string, modelName: string, maxTokens: number) {
		this.cohere = new CohereClient({
			token: apiKey,
		});
		this.modelName = modelName;
		this.maxTokens = maxTokens;
		this.apiKey = apiKey;
		this.name = "cohere";
	}

	display_error = (err: any) => {
		new Notice(err);
	};

	whisper_api_call = async (input: Blob, language: string) => {
		this.display_error("text-to-speech API not supported by Cohere");
	};

	text_to_speech_call = async (input_text: string) => {
		this.display_error("text-to-speech API not supported by Cohere");
	};

	img_api_call = async (
		model: string,
		prompt: string,
		img_size: string,
		num_img: number,
		is_hd: boolean,
	) => {
		this.display_error("Image API not supported by Cohere");
	};

	api_call = async (
		prompt: string,
		selected: string,
		htmlEl?: HTMLElement,
		view?: MarkdownView,
	) => {
		try {
			// Not working?
			const streamMode = false; // htmlEl !== undefined;

			if (streamMode) {
				const stream = await this.cohere.chatStream({
					model: this.modelName,
					message: prompt + " : " + selected,
				});
				let responsetext = "";
				for await (const chat of stream) {
					if (chat.eventType == "text-generation") {
						responsetext.concat(chat.text);
						htmlEl.innerHTML = "";
						if (view) {
							await MarkdownRenderer.renderMarkdown(
								responsetext,
								htmlEl,
								"",
								view,
							);
						} else {
							htmlEl.innerHTML += responsetext;
						}
					}
				}
				return htmlEl.innerHTML;
			} else {
				const prediction = await this.cohere.generate({
					prompt: prompt + " : " + selected,
					maxTokens: this.maxTokens,
				});

				return prediction.generations[0].text;
			}
		} catch (err) {
			this.display_error(err);
		}
	};
}
