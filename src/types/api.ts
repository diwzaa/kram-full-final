interface GalleryItem {
	id: string;
	prompt_message: string;
	tags_id?: string | null;
	create_at: string;
	tag?: {
		id: string;
		name: string;
		image_url: string;
		description: string;
	} | null;
	output_logs: Array<{
		id: string;
		prompt_image_url: string;
		description: string;
		output_tags: string;
	}>;
}

interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
	message?: string;
}

interface PaginatedGalleryResponse {
	data: GalleryItem[];
	pagination: {
		currentPage: number;
		totalPages: number;
		totalItems: number;
		hasNext: boolean;
		hasPrev: boolean;
		limit: number;
	};
}

interface TagResponse {
	id: string;
	image_url: string;
	name: string;
	description: string;
}

interface KramPatternRequest {
	prompt: string;
	tag_ids?: string[];
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

interface GeneratedResult {
	id: string;
	image_url: string;
	description: string;
	output_tags: string;
}

interface KramPatternResponse {
	history_id: string;
	prompt_message: string;
	selected_tags: Array<{
		id: string;
		name: string;
		description: string;
	}>;
	generated_outputs: GeneratedResult[];
	created_at: string;
}

interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
	message?: string;
	debug?: any;
}