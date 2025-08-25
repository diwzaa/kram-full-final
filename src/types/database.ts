// Database types based on Prisma schema
export interface History {
	id: string;
	prompt_message: string;
	tags_id?: string | null;
	create_at: Date;

	// Relations
	tag?: Tags | null;
	output_logs: OutputGenerate[];
}

export interface OutputGenerate {
	id: string;
	history_id: string;
	prompt_image_url: string;
	description: string;
	output_tags: string; // JSON or comma-separated tags

	// Relations
	history: History;
}

export interface Tags {
	id: string;
	image_url: string;
	name: string;
	description: string;

	// Back relation to History
	history: History[];
}

// DTOs for API requests/responses
export interface CreateTagRequest {
	image_url: string;
	name: string;
	description: string;
}

export interface TagResponse {
	id: string;
	image_url: string;
	name: string;
	description: string;
}

export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
	message?: string;
}
