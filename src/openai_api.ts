import { models } from "cohere-ai/api";
import { MarkdownRenderer, MarkdownView, Notice } from "obsidian";

import { OpenAI } from "openai";

export const OpenAIModels = {
	models: {
		"gpt-3.5-turbo": "gpt-3.5-turbo",
		"gpt-4-turbo-preview": "gpt-4-turbo",
		"gpt-4": "gpt-4",
	},
	imgModels: {
		"dall-e-3": "dall-e-3",
		"dall-e-2": "dall-e-2",
	},
};

export class OpenAIAssistant {
	modelName: string;
	apiFun: any;
	maxTokens: number;
	apiKey: string;
	name: "openai";

	constructor(apiKey: string, modelName: string, maxTokens: number) {
		this.apiFun = new OpenAI({
			apiKey: apiKey,
			dangerouslyAllowBrowser: true,
		});
		this.modelName = modelName;
		this.maxTokens = maxTokens;
		this.apiKey = apiKey;
		this.name = "openai";
	}

	display_error = (err: any) => {
		if (err instanceof OpenAI.APIError) {
			new Notice("## OpenAI API ## " + err);
		} else {
			new Notice(err);
		}
	};

	api_call = async (
		prompt_list: { [key: string]: string }[],
		htmlEl?: HTMLElement,
		view?: MarkdownView,
	) => {
		const streamMode = htmlEl !== undefined;
		const has_img = prompt_list.some((el) => Array.isArray(el.content));
		let model = this.modelName;
		if (has_img) {
			model = "gpt-4-vision-preview";
		}
		try {
			const response = await this.apiFun.chat.completions.create({
				messages: prompt_list,
				model: model,
				max_tokens: this.maxTokens,
				stream: streamMode,
			});

			if (streamMode) {
				let responseText = "";
				for await (const chunk of response) {
					const content = chunk.choices[0].delta.content;
					if (content) {
						responseText = responseText.concat(content);
						htmlEl.innerHTML = "";
						if (view) {
							await MarkdownRenderer.renderMarkdown(
								responseText,
								htmlEl,
								"",
								view,
							);
						} else {
							htmlEl.innerHTML += responseText;
						}
					}
				}
				return htmlEl.innerHTML;
			} else {
				return response.choices[0].message.content;
			}
		} catch (err) {
			this.display_error("Hiiiiiii");
		}
	};

	img_api_call = async (
		model: string,
		prompt: string,
		img_size: string,
		num_img: number,
		is_hd: boolean,
	) => {
		try {
			const params: { [key: string]: string | number } = {};
			params.model = model;
			params.prompt = prompt;
			params.n = num_img;
			params.size = img_size;

			if (model === "dall-e-3" && is_hd) {
				params.quality = "hd";
			}

			const response = await this.apiFun.images.generate(params);
			return response.data.map((x: any) => x.url);
		} catch (err) {
			this.display_error(err);
		}
	};

	whisper_api_call = async (input: Blob, language: string) => {
		try {
			const completion = await this.apiFun.audio.transcriptions.create({
				file: input,
				model: "whisper-1",
				language: language,
			});
			return completion.text;
		} catch (err) {
			this.display_error(err);
		}
	};

	text_to_speech_call = async (input_text: string) => {
		try {
			const mp3 = await this.apiFun.audio.speech.create({
				model: "tts-1",
				voice: "alloy",
				input: input_text,
			});

			const blob = new Blob([await mp3.arrayBuffer()], {
				type: "audio/mp3",
			});
			const url = URL.createObjectURL(blob);
			const audio = new Audio(url);

			await audio.play();
		} catch (err) {
			this.display_error(err);
		}
	};
}
