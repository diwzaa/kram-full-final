// Fixed Kram Pattern Helper with correct types
import { imageHelper, ImageResult } from './image';
import { chatHelper, generateImageDescription, generateOutputTags } from './chat';
import { logger } from './open-ai';

// Fixed types to match the API expectations
export interface KramPatternRequest {
	prompt: string;
	tags?: Array<{
		id: string;
		name: string;
		description: string;
		image_url: string;
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
	// Changed to mutable array to match API response type
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
 * Build enhanced prompt with tag context
 */
function buildEnhancedPrompt(userPrompt: string, tags: ReadonlyArray<{ name: string; description: string }> = []): string {
	if (tags.length === 0) {
		return userPrompt;
	}

	const tagContext = tags.map((tag) => `${tag.name} (${tag.description})`).join(', ');

	return `${userPrompt}

Style inspiration from: ${tagContext}

Please incorporate elements and aesthetics from these style references while maintaining the core concept of the original prompt.`;
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
	});

	try {
		// Step 1: Validate request
		const validation = validateKramRequest(request);
		if (!validation.valid) {
			throw new KramPatternError(`Validation failed: ${validation.errors.join(', ')}`, 'VALIDATION_ERROR', 'validation');
		}

		// Step 2: Prepare tag context
		const selectedTags = request.tags || [];
		const tagContext = selectedTags.map((tag) => ({
			name: tag.name,
			description: tag.description,
		}));

		logger.debug('Request validated', {
			selectedTagsCount: selectedTags.length,
			dalleOptions: request.dalle_options,
			chatOptions: request.chat_options,
		});

		// Step 3: Generate image with DALL-E
		const imageGenStartTime = Date.now();
		let imageResult: ImageResult;

		try {
			imageResult = await imageHelper(request.prompt, {
				model: 'dall-e-3',
				size: request.dalle_options?.size || '1024x1024',
				quality: request.dalle_options?.quality || 'standard',
				style: request.dalle_options?.style || 'natural',
				tags: tagContext,
			});
			imageGenTime = Date.now() - imageGenStartTime;

			logger.debug('Image generation completed', {
				imageUrl: imageResult.image_url,
				generationTime: imageGenTime,
			});
		} catch (error) {
			throw new KramPatternError('Failed to generate image', 'IMAGE_GENERATION_ERROR', 'image_generation', error instanceof Error ? error : new Error(String(error)));
		}

		// Step 4: Generate description with ChatGPT
		const descGenStartTime = Date.now();
		let description: string;

		try {
			description = await generateImageDescription(request.prompt, imageResult.image_url, tagContext, {
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

		// Prepare final result - convert to mutable array
		const result: KramPatternResult = {
			image_result: imageResult,
			description,
			output_tags: outputTags,
			processing_time: totalTime,
			selected_tags: selectedTags.map((tag) => ({
				id: tag.id,
				name: tag.name,
				description: tag.description,
			})), // This creates a mutable array, not readonly
		};

		// Log performance metrics
		const metrics: ProcessingMetrics = {
			image_generation_time: imageGenTime,
			description_generation_time: descGenTime,
			tag_generation_time: tagGenTime,
			total_processing_time: totalTime,
		};

		logger.info('Kram Pattern generation completed successfully', metrics);

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
