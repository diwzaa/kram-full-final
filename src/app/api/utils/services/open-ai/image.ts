// Optimized Image Generation Helper for Kram Pattern System
import { getClient, logger, withRetry } from './open-ai';

// Interface for the return type
export interface ImageResult {
	readonly image_url: string;
	readonly revised_prompt?: string;
	readonly original_prompt: string;
	readonly enhanced_prompt: string;
	readonly generation_time: number;
}

interface ImageGenerationResponse {
	readonly data: ReadonlyArray<{
		readonly url?: string;
		readonly revised_prompt?: string;
	}>;
}

interface TagContext {
	readonly name: string;
	readonly description: string;
}

// Pre-allocated template objects for better memory efficiency
const DEFAULT_IMAGE_CONFIG = {
	quality: 'standard' as const,
	n: 1,
	response_format: 'url' as const,
} as const;

const HD_IMAGE_CONFIG = {
	...DEFAULT_IMAGE_CONFIG,
	quality: 'hd' as const,
} as const;

// Template for Kram-specific enhanced prompts
const KRAM_PROMPT_TEMPLATE =
  `A flat 2D pattern inspired by traditional Thai indigo textile (ผ้าครามพื้นเมือง), shown in the style of counted-thread embroidery or cross-stitch chart. The design should consist of repeating geometric folk motifs such as diamonds, chevrons, stars, and small ornamental crosses. The layout must be symmetrical, pixel-perfect, and arranged on a precise square grid. The appearance should be flat, digital, and sharp-edged, resembling a cross-stitch embroidery guide rather than real fabric texture.

Use a limited color palette of deep indigo blue (คราม) and white background for contrast. Avoid gradients, shadows, folds, or realistic cloth rendering. Focus only on the geometric motif structure.

The embroidery pattern {user_prompt}

{tag_context}

Technical requirements:
- Pixel grid cross-stitch style
- Traditional indigo folk motifs (ผ้าคราม style)
- Symmetrical, repeating geometric layout
- Limited solid colors: deep indigo, white
- Sharp, clean edges with no blurring or shading
- Flat 2D pattern chart (not realistic fabric)
- {style_guidance}` as const;




// Style guidance mappings
const STYLE_GUIDANCE: Record<string, string> = {
	vivid: 'Bold color contrast with sharp geometric definition, vibrant reds and deep blues creating striking diamond and chevron patterns',
	natural: 'Subtle color variations with traditional folk art styling, authentic handwoven texture with slight irregularities that add character',
} as const;

/**
 * Build enhanced prompt with tag context and style guidance
 */

function buildEnhancedPrompt(userPrompt: string, tags: ReadonlyArray<{ name: string; description: string }> = [], style: 'vivid' | 'natural' = 'vivid'): string {
	// Build tag context efficiently for geometric textile styling
	const tagContext =
		tags.length > 0
			? `\nTraditional pattern inspiration and geometric techniques:\n${tags.map((tag) => `- ${tag.name}: ${tag.description} (adapted for geometric handwoven textile patterns)`).join('\n')}\n`
			: '';

	// Get style guidance for geometric textile context
	const styleGuidance = STYLE_GUIDANCE[style] || STYLE_GUIDANCE.vivid;

	// Replace template variables efficiently
	return KRAM_PROMPT_TEMPLATE.replace(/{user_prompt}/g, userPrompt)
		.replace('{tag_context}', tagContext)
		.replace('{style_guidance}', styleGuidance);
}

/**
 * Validate prompt for DALL-E requirements
 */
function validatePrompt(prompt: string): { valid: boolean; error?: string } {
	if (!prompt || prompt.trim().length === 0) {
		return { valid: false, error: 'Prompt cannot be empty' };
	}

	if (prompt.length > 1000) {
		return { valid: false, error: 'Prompt too long. DALL-E prompts should be under 1000 characters' };
	}

	// Check for potentially problematic content patterns
	const problematicPatterns = [/\b(nude|naked|nsfw)\b/i, /\b(violence|gore|blood)\b/i, /\b(hate|racist|nazi)\b/i];

	for (const pattern of problematicPatterns) {
		if (pattern.test(prompt)) {
			return { valid: false, error: 'Prompt may violate content policy' };
		}
	}

	return { valid: true };
}

/**
 * Main image generation helper function
 */
export async function imageHelper(
	prompt: string,
	options: {
		model?: string;
		size?: '1024x1024' | '1024x1792' | '1792x1024';
		quality?: 'standard' | 'hd';
		style?: 'vivid' | 'natural';
		tags?: ReadonlyArray<TagContext>;
	} = {},
): Promise<ImageResult> {
	const startTime = Date.now();

	// Extract options with defaults
	const { model = 'dall-e-3', size = '1024x1024', quality = 'standard', style = 'natural', tags = [] } = options;

	logger.debug('Starting image generation', {
		originalPrompt: prompt,
		options: { model, size, quality, style },
		tagsCount: tags.length,
	});

	// Validate input prompt
	const validation = validatePrompt(prompt);
	if (!validation.valid) {
		throw new Error(`Invalid prompt: ${validation.error}`);
	}

	try {
		// Build enhanced prompt with context
		const enhancedPrompt = buildEnhancedPrompt(prompt, tags, style);

		logger.debug('Enhanced prompt created', { enhancedPrompt });

		// Get client instance
		const clientInstance = getClient();

		// Select configuration based on quality
		const config = quality === 'hd' ? HD_IMAGE_CONFIG : DEFAULT_IMAGE_CONFIG;

		// Generate image with retry logic
		const response = await withRetry(async (): Promise<ImageGenerationResponse> => {
			return (await clientInstance.images.generate({
				model,
				prompt: enhancedPrompt,
				size,
				style,
				...config,
			})) as ImageGenerationResponse;
		});

		// Extract result data
		const imageData = response.data?.[0];
		if (!imageData?.url) {
			throw new Error('No image URL returned from DALL-E API');
		}

		const generationTime = Date.now() - startTime;

		// Pre-structured response object for better V8 optimization
		const result: ImageResult = {
			image_url: imageData.url,
			revised_prompt: imageData.revised_prompt,
			original_prompt: prompt,
			enhanced_prompt: enhancedPrompt,
			generation_time: generationTime,
		};

		logger.debug('Image generation completed', {
			imageUrl: result.image_url,
			generationTime,
			revisedPrompt: result.revised_prompt,
		});

		return result;
	} catch (error) {
		const generationTime = Date.now() - startTime;
		const errorMessage = error instanceof Error ? error.message : String(error);

		logger.error('Image generation failed', {
			error: errorMessage,
			originalPrompt: prompt,
			generationTime,
		});

		// Enhance error message based on common DALL-E errors
		let enhancedError = errorMessage;
		if (errorMessage.includes('content_policy_violation')) {
			enhancedError = 'Image prompt violates OpenAI content policy. Please modify your prompt and try again.';
		} else if (errorMessage.includes('rate_limit_exceeded')) {
			enhancedError = 'Rate limit exceeded. Please wait a moment before trying again.';
		} else if (errorMessage.includes('quota_exceeded')) {
			enhancedError = 'API quota exceeded. Please check your OpenAI account usage.';
		}

		throw new Error(`Image generation failed: ${enhancedError}`);
	}
}

/**
 * Batch image generation with rate limiting
 */
export async function generateImageBatch(
	prompts: Array<{ prompt: string; options?: Parameters<typeof imageHelper>[1] }>,
	batchOptions: {
		maxConcurrent?: number;
		delayBetweenBatches?: number;
	} = {},
): Promise<Array<{ success: boolean; result?: ImageResult; error?: string; prompt: string }>> {
	const { maxConcurrent = 2, delayBetweenBatches = 3000 } = batchOptions;
	const results: Array<{ success: boolean; result?: ImageResult; error?: string; prompt: string }> = [];

	logger.info(`Starting batch image generation: ${prompts.length} prompts`);

	// Process in batches to respect rate limits
	for (let i = 0; i < prompts.length; i += maxConcurrent) {
		const batch = prompts.slice(i, i + maxConcurrent);

		const batchPromises = batch.map(async ({ prompt, options }) => {
			try {
				const result = await imageHelper(prompt, options);
				return { success: true as const, result, prompt };
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				return { success: false as const, error: errorMessage, prompt };
			}
		});

		const batchResults = await Promise.allSettled(batchPromises);

		// Process settled promises
		batchResults.forEach((settledResult) => {
			if (settledResult.status === 'fulfilled') {
				results.push(settledResult.value);
			} else {
				results.push({
					success: false,
					error: settledResult.reason?.message || 'Unknown error',
					prompt: 'Unknown prompt',
				});
			}
		});

		// Add delay between batches (except for the last batch)
		if (i + maxConcurrent < prompts.length) {
			logger.debug(`Batch completed, waiting ${delayBetweenBatches}ms before next batch`);
			await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
		}
	}

	const successCount = results.filter((r) => r.success).length;
	const failureCount = results.length - successCount;

	logger.info(`Batch image generation completed: ${successCount} successful, ${failureCount} failed`);

	return results;
}

// Export for backward compatibility
export default imageHelper;
