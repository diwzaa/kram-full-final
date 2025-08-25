import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { GalleryResponse, GallerySearchParams, PaginatedGalleryResponse, ApiResponse } from '@/types/gallery';

const prisma = new PrismaClient();

// GET /api/v1/kram/gallery - Get all history records with search and pagination
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<PaginatedGalleryResponse>>> {
	try {
		const { searchParams } = new URL(request.url);

		// Parse query parameters
		const search = searchParams.get('search') || '';
		const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
		const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10')));
		const sortBy = (searchParams.get('sortBy') as 'create_at' | 'prompt_message') || 'create_at';
		const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

		const skip = (page - 1) * limit;

		// Build where clause for search
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

		// Get total count for pagination
		const totalItems = await prisma.history.count({
			where: whereClause,
		});

		// Get paginated data
		const historyRecords = await prisma.history.findMany({
			where: whereClause,
			include: {
				tag: true,
				output_logs: {
					select: {
						id: true,
						prompt_image_url: true,
						description: true,
						output_tags: true,
					},
				},
			},
			orderBy: {
				[sortBy]: sortOrder,
			},
			skip,
			take: limit,
		});

		// Transform data for response
		const transformedData: GalleryResponse[] = historyRecords.map((record) => ({
			id: record.id,
			prompt_message: record.prompt_message,
			tags_id: record.tags_id,
			create_at: record.create_at.toISOString(),
			tag: record.tag
				? {
						id: record.tag.id,
						name: record.tag.name,
						image_url: record.tag.image_url,
						description: record.tag.description,
				  }
				: null,
			output_logs: record.output_logs,
		}));

		// Calculate pagination info
		const totalPages = Math.ceil(totalItems / limit);
		const hasNext = page < totalPages;
		const hasPrev = page > 1;

		const paginatedResponse: PaginatedGalleryResponse = {
			data: transformedData,
			pagination: {
				currentPage: page,
				totalPages,
				totalItems,
				hasNext,
				hasPrev,
				limit,
			},
		};

		const response: ApiResponse<PaginatedGalleryResponse> = {
			success: true,
			data: paginatedResponse,
			message: `Found ${totalItems} gallery items${search ? ` matching "${search}"` : ''}`,
		};

		return NextResponse.json(response, { status: 200 });
	} catch (error) {
		console.error('Error fetching gallery:', error);

		const errorResponse: ApiResponse<PaginatedGalleryResponse> = {
			success: false,
			error: 'Failed to fetch gallery',
			message: error instanceof Error ? error.message : 'Unknown error occurred',
		};

		return NextResponse.json(errorResponse, { status: 500 });
	} finally {
		await prisma.$disconnect();
	}
}
