import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { KramPatternRequest, KramPatternResponse, ApiResponse } from '@/types/open-ai';
import { generateKramPattern, KramPatternError, validateKramPatternRequest, estimateProcessingCost } from '@/app/api/utils/services/open-ai/kram-pattern';
import { initializeClient, logger } from '@/app/api/utils/services/open-ai/open-ai';

const prisma = new PrismaClient();

// Initialize OpenAI client on module load
let clientInitialized = false;

async function ensureClientInitialized(): Promise<void> {
	if (!clientInitialized) {
		try {
			await initializeClient();
			clientInitialized = true;
			logger.info('OpenAI client initialized successfully');
		} catch (error) {
			logger.error('Failed to initialize OpenAI client', error);
			throw error;
		}
	}
}

// POST /api/v1/kram/generate/kram-pattern - Generate Kram Pattern with AI
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<KramPatternResponse>>> {
	const startTime = Date.now();

	try {
		// Ensure OpenAI client is initialized
		await ensureClientInitialized();

		const body: KramPatternRequest = await request.json();

		logger.info('Received Kram Pattern generation request', {
			promptLength: body.prompt?.length || 0,
			tagIds: body.tag_ids?.length || 0,
			options: {
				dalle: body.dalle_options,
				chat: body.chat_options,
			},
		});

		// Validate request using helper
		const validation = validateKramPatternRequest({
			prompt: body.prompt,
			tags: [], // We'll validate tag IDs separately
			dalle_options: body.dalle_options,
			chat_options: body.chat_options,
		});

		if (!validation.valid) {
			const errorResponse: ApiResponse<KramPatternResponse> = {
				success: false,
				error: 'Invalid request parameters',
				message: validation.errors.join(', '),
			};
			return NextResponse.json(errorResponse, { status: 400 });
		}

		// Fetch selected tags if provided
		let selectedTags: Array<{
			id: string;
			name: string;
			description: string;
			image_url: string;
		}> = [];

		if (body.tag_ids && body.tag_ids.length > 0) {
			// Validate tag IDs format
			const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
			const invalidIds = body.tag_ids.filter((id) => !uuidRegex.test(id));

			if (invalidIds.length > 0) {
				const errorResponse: ApiResponse<KramPatternResponse> = {
					success: false,
					error: 'Invalid tag IDs',
					message: `Invalid UUID format for tag IDs: ${invalidIds.join(', ')}`,
				};
				return NextResponse.json(errorResponse, { status: 400 });
			}

			// Fetch tags from database with all required fields
			selectedTags = await prisma.tags.findMany({
				where: {
					id: {
						in: body.tag_ids,
					},
				},
				select: {
					id: true,
					name: true,
					description: true,
					image_url: true, // Make sure to include image_url
				},
			});

			// Check if all requested tags were found
			if (selectedTags.length !== body.tag_ids.length) {
				const foundIds = selectedTags.map((tag) => tag.id);
				const missingIds = body.tag_ids.filter((id) => !foundIds.includes(id));

				const errorResponse: ApiResponse<KramPatternResponse> = {
					success: false,
					error: 'Tags not found',
					message: `The following tag IDs were not found: ${missingIds.join(', ')}`,
				};
				return NextResponse.json(errorResponse, { status: 404 });
			}

			// Validate that all tags have image_url
			const tagsWithoutImages = selectedTags.filter((tag) => !tag.image_url || tag.image_url.trim() === '');
			if (tagsWithoutImages.length > 0) {
				const errorResponse: ApiResponse<KramPatternResponse> = {
					success: false,
					error: 'Tags missing image URLs',
					message: `The following tags are missing image URLs: ${tagsWithoutImages.map((t) => t.name).join(', ')}`,
				};
				return NextResponse.json(errorResponse, { status: 400 });
			}
		}

		// Log cost estimation
		const costEstimate = estimateProcessingCost({
			prompt: body.prompt,
			tags: selectedTags,
			dalle_options: body.dalle_options,
			chat_options: body.chat_options,
		});

		logger.debug('Processing cost estimate', costEstimate);
		logger.debug('Selected tags with image URLs', {
			tags: selectedTags.map((tag) => ({
				id: tag.id,
				name: tag.name,
				hasImageUrl: !!tag.image_url,
			})),
		});

		// Generate Kram Pattern using helper - Pass the full tag objects with image_url
		let kramResult;
		try {
			kramResult = await generateKramPattern({
				prompt: body.prompt,
				tags: selectedTags, // This now includes image_url field
				dalle_options: body.dalle_options,
				chat_options: body.chat_options,
			});
		} catch (error) {
			if (error instanceof KramPatternError) {
				// Map Kram pattern errors to appropriate HTTP status codes
				let statusCode = 500;
				switch (error.code) {
					case 'VALIDATION_ERROR':
						statusCode = 400;
						break;
					case 'IMAGE_GENERATION_ERROR':
						if (error.originalError?.message?.includes('content_policy_violation')) {
							statusCode = 400;
						} else if (error.originalError?.message?.includes('rate_limit')) {
							statusCode = 429;
						} else {
							statusCode = 502;
						}
						break;
					case 'DESCRIPTION_GENERATION_ERROR':
					case 'TAG_GENERATION_ERROR':
						statusCode = 502;
						break;
					default:
						statusCode = 500;
				}

				const errorResponse: ApiResponse<KramPatternResponse> = {
					success: false,
					error: `${error.phase} failed`,
					message: error.message,
				};
				return NextResponse.json(errorResponse, { status: statusCode });
			}

			throw error; // Re-throw non-KramPatternError errors
		}

		// Create database records
		logger.debug('Saving results to database');

		const historyRecord = await prisma.history.create({
			data: {
				prompt_message: body.prompt,
				tags_id: selectedTags.length > 0 ? selectedTags[0].id : null,
			},
		});

		const outputRecord = await prisma.outputGenerate.create({
			data: {
				history_id: historyRecord.id,
				prompt_image_url: kramResult.image_result.image_url,
				description: kramResult.description,
				output_tags: kramResult.output_tags,
			},
		});

		const totalProcessingTime = Date.now() - startTime;

		// Prepare response - Only return id, name, description for API response
		const responseData: KramPatternResponse = {
			history_id: historyRecord.id,
			prompt_message: historyRecord.prompt_message,
			selected_tags: kramResult.selected_tags.map((tag: any) => ({
				id: tag.id,
				name: tag.name,
				description: tag.description,
				// Don't expose image_url in API response for security/bandwidth reasons
			})),
			generated_outputs: [
				{
					id: outputRecord.id,
					image_url: outputRecord.prompt_image_url,
					description: outputRecord.description,
					output_tags: outputRecord.output_tags,
				},
			],
			created_at: historyRecord.create_at.toISOString(),
		};

		const response: ApiResponse<KramPatternResponse> = {
			success: true,
			data: responseData,
			message: 'Kram pattern generated successfully',
			debug:
				process.env.NODE_ENV === 'development'
					? {
							processing_time: totalProcessingTime,
							ai_processing_time: kramResult.processing_time,
							cost_estimate: costEstimate,
							image_generation_time: kramResult.image_result.generation_time,
							selected_tags_with_images: selectedTags.map((tag) => ({
								id: tag.id,
								name: tag.name,
								has_image_url: !!tag.image_url,
							})),
					  }
					: undefined,
		};

		logger.info(`Kram pattern generation completed successfully in ${totalProcessingTime}ms`, {
			historyId: historyRecord.id,
			imageUrl: kramResult.image_result.image_url,
			processingTime: totalProcessingTime,
		});

		return NextResponse.json(response, { status: 201 });
	} catch (error) {
		const processingTime = Date.now() - startTime;

		logger.error('Kram pattern generation failed', {
			error: error instanceof Error ? error.message : String(error),
			processingTime,
			stack: error instanceof Error ? error.stack : undefined,
		});

		// Determine error type and appropriate status code
		let statusCode = 500;
		let errorMessage = 'Failed to generate Kram pattern';

		if (error instanceof Error) {
			if (error.message.includes('Client not initialized')) {
				statusCode = 500;
				errorMessage = 'AI service not available';
			} else if (error.message.includes('rate limit')) {
				statusCode = 429;
				errorMessage = 'API rate limit exceeded, please try again later';
			} else if (error.message.includes('quota')) {
				statusCode = 429;
				errorMessage = 'API quota exceeded';
			} else if (error.message.includes('content policy')) {
				statusCode = 400;
				errorMessage = 'Content violates usage policies';
			} else if (error.message.includes('SyntaxError')) {
				statusCode = 400;
				errorMessage = 'Invalid JSON in request body';
			}
		}

		const errorResponse: ApiResponse<KramPatternResponse> = {
			success: false,
			error: errorMessage,
			message: error instanceof Error ? error.message : 'Unknown error occurred',
			debug:
				process.env.NODE_ENV === 'development'
					? {
							processing_time: processingTime,
							stack: error instanceof Error ? error.stack : undefined,
					  }
					: undefined,
		};

		return NextResponse.json(errorResponse, { status: statusCode });
	} finally {
		await prisma.$disconnect();
	}
}
