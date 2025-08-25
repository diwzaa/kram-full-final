import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { GalleryResponse, ApiResponse } from '@/types/gallery';

const prisma = new PrismaClient();

// GET /api/v1/kram/gallery/[id] - Get specific history record by ID
export async function GET(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse<ApiResponse<GalleryResponse>>> {
	try {
		const { id } = params;

		// Validate UUID format
		const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
		if (!uuidRegex.test(id)) {
			const errorResponse: ApiResponse<GalleryResponse> = {
				success: false,
				error: 'Invalid ID format',
				message: 'The provided ID is not a valid UUID',
			};
			return NextResponse.json(errorResponse, { status: 400 });
		}

		// Find the specific history record
		const historyRecord = await prisma.history.findUnique({
			where: {
				id: id,
			},
			include: {
				tag: true,
				output_logs: {
					select: {
						id: true,
						prompt_image_url: true,
						description: true,
						output_tags: true,
					},
					orderBy: {
						id: 'asc', // Consistent ordering for output logs
					},
				},
			},
		});

		// Check if record exists
		if (!historyRecord) {
			const errorResponse: ApiResponse<GalleryResponse> = {
				success: false,
				error: 'Gallery item not found',
				message: `No gallery item found with ID: ${id}`,
			};
			return NextResponse.json(errorResponse, { status: 404 });
		}

		// Transform data for response
		const transformedData: GalleryResponse = {
			id: historyRecord.id,
			prompt_message: historyRecord.prompt_message,
			tags_id: historyRecord.tags_id,
			create_at: historyRecord.create_at.toISOString(),
			tag: historyRecord.tag
				? {
						id: historyRecord.tag.id,
						name: historyRecord.tag.name,
						image_url: historyRecord.tag.image_url,
						description: historyRecord.tag.description,
				  }
				: null,
			output_logs: historyRecord.output_logs,
		};

		const response: ApiResponse<GalleryResponse> = {
			success: true,
			data: transformedData,
			message: 'Gallery item retrieved successfully',
		};

		return NextResponse.json(response, { status: 200 });
	} catch (error) {
		console.error('Error fetching gallery item:', error);

		const errorResponse: ApiResponse<GalleryResponse> = {
			success: false,
			error: 'Failed to fetch gallery item',
			message: error instanceof Error ? error.message : 'Unknown error occurred',
		};

		return NextResponse.json(errorResponse, { status: 500 });
	} finally {
		await prisma.$disconnect();
	}
}
