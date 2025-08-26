// Updated Kram Pattern Helper with Image URL support
import { imageHelper, ImageResult } from './image';
import { chatHelper, generateImageDescription, generateOutputTags } from './chat';
import { logger } from './open-ai';

// Updated types to include image_url
export interface KramPatternRequest {
	prompt: string;
	tags?: Array<{
		id: string;
		name: string;
		description: string;
		image_url: string; // Added image_url field
	}>;
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

export interface KramPatternResult {
	readonly image_result: ImageResult;
	readonly description: string;
	readonly output_tags: string;
	readonly processing_time: number;
	selected_tags: Array<{
		id: string;
		name: string;
		description: string;
	}>;
}

// Performance monitoring
interface ProcessingMetrics {
	image_generation_time: number;
	description_generation_time: number;
	tag_generation_time: number;
	total_processing_time: number;
}

// Error classes for better error handling
export class KramPatternError extends Error {
	constructor(
		message: string,
		public readonly code: string,
		public readonly phase: 'validation' | 'image_generation' | 'description_generation' | 'tag_generation',
		public readonly originalError?: Error,
	) {
		super(message);
		this.name = 'KramPatternError';
		Object.setPrototypeOf(this, KramPatternError.prototype);
	}
}

/**
 * Validate Kram pattern request
 */
function validateKramRequest(request: KramPatternRequest): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	// Validate prompt
	if (!request.prompt || request.prompt.trim().length === 0) {
		errors.push('Prompt cannot be empty');
	} else if (request.prompt.length > 900) {
		errors.push('Prompt too long (max 900 characters)');
	}

	// Validate tags if provided
	if (request.tags) {
		if (request.tags.length > 10) {
			errors.push('Too many tags (max 10 allowed)');
		}

		const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
		const invalidTags = request.tags.filter((tag) => !uuidRegex.test(tag.id));

		if (invalidTags.length > 0) {
			errors.push('Invalid tag ID format');
		}

		// Validate that all tags have image_url
		const tagsWithoutImages = request.tags.filter((tag) => !tag.image_url || tag.image_url.trim() === '');
		if (tagsWithoutImages.length > 0) {
			errors.push(`Tags missing image URLs: ${tagsWithoutImages.map((t) => t.name).join(', ')}`);
		}
	}

	// Validate DALL-E options
	if (request.dalle_options) {
		const { size, quality, style } = request.dalle_options;

		if (size && !['1024x1024', '1792x1024', '1024x1792'].includes(size)) {
			errors.push('Invalid image size');
		}

		if (quality && !['standard', 'hd'].includes(quality)) {
			errors.push('Invalid image quality');
		}

		if (style && !['vivid', 'natural'].includes(style)) {
			errors.push('Invalid image style');
		}
	}

	// Validate chat options
	if (request.chat_options) {
		const { model, max_tokens } = request.chat_options;

		if (model && !['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'].includes(model)) {
			errors.push('Invalid chat model');
		}

		if (max_tokens && (max_tokens < 50 || max_tokens > 2000)) {
			errors.push('Invalid max_tokens (must be between 50 and 2000)');
		}
	}

	return { valid: errors.length === 0, errors };
}

/**
 * Build enhanced prompt with tag context - now includes image URLs for DALL-E
 */
function buildEnhancedPromptWithImages(userPrompt: string, tags: ReadonlyArray<{ name: string; description?: string; image_url?: string }> = []): string {
	if (tags.length === 0) {
		return userPrompt;
	}

	// Create style context from tag names and descriptions
	const styleContext = tags.map((tag) => `${tag.name} (${tag.description})`).join(', ');

	// Create image reference context for DALL-E (this tells DALL-E about reference images)
	const imageReferences = tags.map((tag, index) => `Reference image ${index + 1}: ${tag.name} style from ${tag.image_url}`).join('\n');

	return `${userPrompt}

Style inspiration from: ${styleContext}

Reference images to incorporate stylistic elements from:
${imageReferences}

Please create an image that combines the core concept from the original prompt with visual style elements inspired by the reference images above. Maintain the artistic integrity while incorporating the aesthetic qualities from these style references.`;
}

/**
 * Main Kram Pattern generation function
 */
export async function generateKramPattern(request: KramPatternRequest): Promise<KramPatternResult> {
	const startTime = Date.now();
	let imageGenTime = 0;
	let descGenTime = 0;
	let tagGenTime = 0;

	logger.info('Starting Kram Pattern generation', {
		promptLength: request.prompt.length,
		tagsCount: request.tags?.length || 0,
		tagsWithImages: request.tags?.filter((t) => !!t.image_url).length || 0,
	});

	try {
		// Step 1: Validate request
		const validation = validateKramRequest(request);
		if (!validation.valid) {
			throw new KramPatternError(`Validation failed: ${validation.errors.join(', ')}`, 'VALIDATION_ERROR', 'validation');
		}

		// Step 2: Prepare tag context with image URLs
		const selectedTags = request.tags || [];

		// Create context for image generation (with image URLs)
		const imageTagContext = selectedTags.map((tag) => ({
			name: tag.name,
			// description: tag.description,
			image_url: tag.image_url, // Include image URL for DALL-E
		}));

		// Create context for text generation (without image URLs for security)
		const textTagContext = selectedTags.map((tag) => ({
			name: tag.name,
			description: tag.description,
		}));

		logger.debug('Request validated', {
			selectedTagsCount: selectedTags.length,
			tagsWithImages: imageTagContext.filter((t) => !!t.image_url).length,
			dalleOptions: request.dalle_options,
			chatOptions: request.chat_options,
		});

		// Step 3: Generate image with DALL-E using image URLs
		const imageGenStartTime = Date.now();
		let imageResult: ImageResult;

		try {
			// Use the enhanced prompt with image URLs for DALL-E
			const enhancedPrompt = buildEnhancedPromptWithImages(request.prompt, imageTagContext);

			imageResult = await imageHelper(enhancedPrompt, {
				model: 'dall-e-3',
				size: request.dalle_options?.size || '1024x1024',
				quality: request.dalle_options?.quality || 'standard',
				style: request.dalle_options?.style || 'vivid',
				// Note: imageHelper should be updated to handle image URLs if needed
				// For now, the enhanced prompt includes image URL references
			});

			imageGenTime = Date.now() - imageGenStartTime;

			logger.debug('Image generation completed', {
				imageUrl: imageResult.image_url,
				generationTime: imageGenTime,
				usedImageReferences: imageTagContext.length > 0,
			});
		} catch (error) {
			throw new KramPatternError('Failed to generate image', 'IMAGE_GENERATION_ERROR', 'image_generation', error instanceof Error ? error : new Error(String(error)));
		}

		// Step 4: Generate description with ChatGPT (using text context only)
		const descGenStartTime = Date.now();
		let description: string;

		try {
			description = await generateImageDescription(request.prompt, imageResult.image_url, textTagContext, {
				model: request.chat_options?.model || 'gpt-4-turbo',
				maxTokens: request.chat_options?.max_tokens || 300,
			});
			descGenTime = Date.now() - descGenStartTime;

			logger.debug('Description generation completed', {
				descriptionLength: description.length,
				generationTime: descGenTime,
			});
		} catch (error) {
			throw new KramPatternError('Failed to generate description', 'DESCRIPTION_GENERATION_ERROR', 'description_generation', error instanceof Error ? error : new Error(String(error)));
		}

		// Step 5: Generate output tags
		const tagGenStartTime = Date.now();
		let outputTags: string;

		try {
			outputTags = await generateOutputTags(
				request.prompt,
				description,
				selectedTags.map((tag) => ({ name: tag.name })),
				{
					model: request.chat_options?.model || 'gpt-4-turbo',
					maxTokens: 100,
				},
			);
			tagGenTime = Date.now() - tagGenStartTime;

			logger.debug('Tag generation completed', {
				outputTags,
				generationTime: tagGenTime,
			});
		} catch (error) {
			throw new KramPatternError('Failed to generate tags', 'TAG_GENERATION_ERROR', 'tag_generation', error instanceof Error ? error : new Error(String(error)));
		}

		const totalTime = Date.now() - startTime;

		// Prepare final result - don't include image URLs in response for security
		const result: KramPatternResult = {
			image_result: imageResult,
			description,
			output_tags: outputTags,
			processing_time: totalTime,
			selected_tags: selectedTags.map((tag) => ({
				id: tag.id,
				name: tag.name,
				description: tag.description,
				// image_url is intentionally excluded from response
			})),
		};

		// Log performance metrics
		const metrics: ProcessingMetrics = {
			image_generation_time: imageGenTime,
			description_generation_time: descGenTime,
			tag_generation_time: tagGenTime,
			total_processing_time: totalTime,
		};

		logger.info('Kram Pattern generation completed successfully', {
			...metrics,
			usedImageReferences: imageTagContext.length > 0,
		});

		return result;
	} catch (error) {
		const totalTime = Date.now() - startTime;

		logger.error('Kram Pattern generation failed', {
			error: error instanceof Error ? error.message : String(error),
			processingTime: totalTime,
			phase: error instanceof KramPatternError ? error.phase : 'unknown',
		});

		// Re-throw KramPatternError as-is, wrap others
		if (error instanceof KramPatternError) {
			throw error;
		}

		throw new KramPatternError(error instanceof Error ? error.message : String(error), 'UNKNOWN_ERROR', 'validation', error instanceof Error ? error : new Error(String(error)));
	}
}

/**
 * Quick validation function for external use
 */
export function validateKramPatternRequest(request: KramPatternRequest): {
	valid: boolean;
	errors: string[];
} {
	return validateKramRequest(request);
}

/**
 * Utility function to estimate processing costs (approximate)
 */
export function estimateProcessingCost(request: KramPatternRequest): {
	dalle_cost_usd: number;
	chat_cost_usd: number;
	estimated_total_usd: number;
} {
	// DALL-E 3 pricing (approximate as of 2024)
	const dalleBaseCost = 0.04; // Standard quality
	const dalleHDMultiplier = 2; // HD costs about 2x more

	const dalle_cost_usd = request.dalle_options?.quality === 'hd' ? dalleBaseCost * dalleHDMultiplier : dalleBaseCost;

	// ChatGPT pricing (very rough estimate)
	const estimatedTokens = 1000; // Rough estimate for description + tags generation
	const chat_cost_usd = 0.005; // Very rough estimate

	return {
		dalle_cost_usd,
		chat_cost_usd,
		estimated_total_usd: dalle_cost_usd + chat_cost_usd,
	};
}

// Export for backward compatibility
export default generateKramPattern;
