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