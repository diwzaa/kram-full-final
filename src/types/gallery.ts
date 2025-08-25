// Gallery types for History table API
export interface HistoryRecord {
	id: string;
	prompt_message: string;
	tags_id?: string | null;
	create_at: Date;

	// Relations
	tag?: {
		id: string;
		name: string;
		image_url: string;
		description: string;
	} | null;
	output_logs: {
		id: string;
		prompt_image_url: string;
		description: string;
		output_tags: string;
	}[];
}

export interface GalleryResponse {
	id: string;
	prompt_message: string;
	tags_id?: string | null;
	create_at: string; // ISO string for JSON serialization

	// Relations
	tag?: {
		id: string;
		name: string;
		image_url: string;
		description: string;
	} | null;
	output_logs: {
		id: string;
		prompt_image_url: string;
		description: string;
		output_tags: string;
	}[];
}

export interface GallerySearchParams {
	search?: string; // Search by name or keywords
	page?: number;
	limit?: number;
	sortBy?: 'create_at' | 'prompt_message';
	sortOrder?: 'asc' | 'desc';
}

export interface PaginatedGalleryResponse {
	data: GalleryResponse[];
	pagination: {
		currentPage: number;
		totalPages: number;
		totalItems: number;
		hasNext: boolean;
		hasPrev: boolean;
		limit: number;
	};
}

export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
	message?: string;
}
