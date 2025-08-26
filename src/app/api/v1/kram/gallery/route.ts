import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { GalleryResponse, GallerySearchParams, PaginatedGalleryResponse, ApiResponse } from '@/types/gallery';

// Use singleton pattern for Prisma client to avoid connection issues
declare global {
	var __prisma: PrismaClient | undefined;
}

// Create a singleton Prisma instance
const getPrismaClient = () => {
	if (process.env.NODE_ENV === 'production') {
		return new PrismaClient({
			log: ['error'],
			errorFormat: 'minimal',
		});
	} else {
		if (!global.__prisma) {
			global.__prisma = new PrismaClient({
				log: ['error'],
				errorFormat: 'pretty',
			});
		}
		return global.__prisma;
	}
};

const prisma = getPrismaClient();

// Connection health check function
async function checkDatabaseConnection(): Promise<boolean> {
	try {
		await prisma.$connect();
		// Simple query to test connection
		await prisma.$queryRaw`SELECT 1`;
		return true;
	} catch (error) {
		console.error('Database connection check failed:', error);
		return false;
	}
}

// Enhanced error handling function
function handleDatabaseError(error: any): { status: number; message: string } {
	console.error('Database error details:', {
		name: error?.name,
		message: error?.message,
		code: error?.code,
		stack: error?.stack?.substring(0, 500),
	});

	// Handle specific Prisma errors
	if (error?.code === 'P1001') {
		return {
			status: 503,
			message: 'Database connection failed. Please try again later.',
		};
	}

	if (error?.code === 'P2002') {
		return {
			status: 409,
			message: 'A record with this data already exists.',
		};
	}

	if (error?.code === 'P2025') {
		return {
			status: 404,
			message: 'Record not found.',
		};
	}

	if (error?.message?.includes('Empty response')) {
		return {
			status: 503,
			message: 'Database service temporarily unavailable. Please retry.',
		};
	}

	if (error?.message?.includes('Connection pool timeout')) {
		return {
			status: 503,
			message: 'Database connection timeout. Please try again.',
		};
	}

	return {
		status: 500,
		message: 'Internal database error occurred.',
	};
}

// GET /api/v1/kram/gallery - Get all history records with search and pagination
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<PaginatedGalleryResponse>>> {
	let connectionAttempts = 0;
	const maxRetries = 3;
	const retryDelay = 1000; // 1 second

	const performDatabaseOperation = async (): Promise<NextResponse<ApiResponse<PaginatedGalleryResponse>>> => {
		try {
			// Check database connection first
			const isConnected = await checkDatabaseConnection();
			if (!isConnected) {
				throw new Error('Database connection failed');
			}

			const { searchParams } = new URL(request.url);

			// Parse and validate query parameters with better defaults
			const search = searchParams.get('search')?.trim() || '';
			const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
			const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10') || 10));
			const sortBy = ['create_at', 'prompt_message'].includes(searchParams.get('sortBy') || '') ? (searchParams.get('sortBy') as 'create_at' | 'prompt_message') : 'create_at';
			const sortOrder = ['asc', 'desc'].includes(searchParams.get('sortOrder') || '') ? (searchParams.get('sortOrder') as 'asc' | 'desc') : 'desc';

			const skip = (page - 1) * limit;

			// Build more efficient where clause for search
			const whereClause = search
				? {
						OR: [
							{
								prompt_message: {
									contains: search,
									mode: 'insensitive' as const,
								},
							},
							{
								tag: {
									name: {
										contains: search,
										mode: 'insensitive' as const,
									},
								},
							},
							{
								tag: {
									description: {
										contains: search,
										mode: 'insensitive' as const,
									},
								},
							},
							{
								output_logs: {
									some: {
										description: {
											contains: search,
											mode: 'insensitive' as const,
										},
									},
								},
							},
							{
								output_logs: {
									some: {
										output_tags: {
											contains: search,
											mode: 'insensitive' as const,
										},
									},
								},
							},
						],
				  }
				: {};

			console.log('Executing database queries with params:', {
				search,
				page,
				limit,
				sortBy,
				sortOrder,
				skip,
			});

			// Use transaction for consistency and better error handling
			const result = await prisma.$transaction(async (tx) => {
				// Get total count for pagination
				const totalItems = await tx.history.count({
					where: whereClause,
				});

				// Get paginated data with optimized query
				const historyRecords = await tx.history.findMany({
					where: whereClause,
					include: {
						tag: {
							select: {
								id: true,
								name: true,
								image_url: true,
								description: true,
							},
						},
						output_logs: {
							select: {
								id: true,
								prompt_image_url: true,
								description: true,
								output_tags: true,
							},
							orderBy: {
								id: 'asc',
							},
						},
					},
					orderBy: {
						[sortBy]: sortOrder,
					},
					skip,
					take: limit,
				});

				return { totalItems, historyRecords };
			});

			console.log(`Successfully retrieved ${result.historyRecords.length} records out of ${result.totalItems} total`);

			// Transform data for response
			const transformedData: GalleryResponse[] = result.historyRecords.map((record) => ({
				id: record.id,
				prompt_message: record.prompt_message,
				tags_id: record.tags_id,
				create_at: record.create_at.toISOString(),
				tag: record.tag || null,
				output_logs: record.output_logs,
			}));

			// Calculate pagination info
			const totalPages = Math.ceil(result.totalItems / limit);
			const hasNext = page < totalPages;
			const hasPrev = page > 1;

			const paginatedResponse: PaginatedGalleryResponse = {
				data: transformedData,
				pagination: {
					currentPage: page,
					totalPages,
					totalItems: result.totalItems,
					hasNext,
					hasPrev,
					limit,
				},
			};

			const response: ApiResponse<PaginatedGalleryResponse> = {
				success: true,
				data: paginatedResponse,
				message: `Found ${result.totalItems} gallery items${search ? ` matching "${search}"` : ''}`,
			};

			return NextResponse.json(response, { status: 200 });
		} catch (error) {
			console.error(`Database operation failed (attempt ${connectionAttempts + 1}/${maxRetries}):`, error);

			// If we can retry and it's a connection-related error, throw to trigger retry
			if (connectionAttempts < maxRetries - 1) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				if (errorMessage.includes('Empty response') || errorMessage.includes('Connection') || errorMessage.includes('timeout') || errorMessage.includes('ECONNREFUSED')) {
					throw error; // This will trigger a retry
				}
			}

			// Handle the error and return response
			const errorDetails = handleDatabaseError(error);

			const errorResponse: ApiResponse<PaginatedGalleryResponse> = {
				success: false,
				error: 'Failed to fetch gallery',
				message: errorDetails.message,
			};

			return NextResponse.json(errorResponse, { status: errorDetails.status });
		}
	};

	// Retry logic with exponential backoff
	while (connectionAttempts < maxRetries) {
		try {
			return await performDatabaseOperation();
		} catch (error) {
			connectionAttempts++;

			if (connectionAttempts >= maxRetries) {
				// Final attempt failed, return error
				const errorDetails = handleDatabaseError(error);

				const errorResponse: ApiResponse<PaginatedGalleryResponse> = {
					success: false,
					error: 'Failed to fetch gallery',
					message: `${errorDetails.message} (Failed after ${maxRetries} attempts)`,
				};

				return NextResponse.json(errorResponse, { status: errorDetails.status });
			}

			// Wait before retrying with exponential backoff
			const delay = retryDelay * Math.pow(2, connectionAttempts - 1);
			console.log(`Retrying database operation in ${delay}ms (attempt ${connectionAttempts}/${maxRetries})`);
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}

	// This should never be reached, but TypeScript requires a return
	const errorResponse: ApiResponse<PaginatedGalleryResponse> = {
		success: false,
		error: 'Failed to fetch gallery',
		message: 'Unexpected error in retry logic',
	};

	return NextResponse.json(errorResponse, { status: 500 });
}
