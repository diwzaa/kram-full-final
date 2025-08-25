// Fixed OpenAI API Types and Interfaces

export interface KramPatternRequest {
	prompt: string;
	tag_ids?: string[]; // Optional list of tag IDs to include in generation
	dalle_options?: {
		size?: '1024x1024' | '1792x1024' | '1024x1792';
		quality?: 'standard' | 'hd';
		style?: 'vivid' | 'natural';
	};
	chat_options?: {
		model?: 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo';
		max_tokens?: number;
	};
}

export interface KramPatternResponse {
	history_id: string;
	prompt_message: string;
	selected_tags: Array<{
		id: string;
		name: string;
		description: string;
	}>; // Changed from readonly to mutable
	generated_outputs: Array<{
		id: string;
		image_url: string;
		description: string;
		output_tags: string;
	}>;
	created_at: string;
}

export interface DalleImageResponse {
	created: number;
	data: Array<{
		url: string;
		revised_prompt?: string;
	}>;
}

export interface ChatCompletionResponse {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: Array<{
		index: number;
		message: {
			role: string;
			content: string;
		};
		finish_reason: string;
	}>;
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

// Fixed ApiResponse with expanded debug type
export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
	message?: string;
	debug?: {
		dalle_response?: any;
		chat_response?: any;
		processing_time?: number;
		ai_processing_time?: number; // Added for kram pattern
		cost_estimate?: {
			dalle_cost_usd: number;
			chat_cost_usd: number;
			estimated_total_usd: number;
		};
		image_generation_time?: number; // Added for kram pattern
		stack?: string; // Added for error debugging
		[key: string]: any; // Allow additional debug properties
	};
}
