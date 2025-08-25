import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { CreateTagRequest, TagResponse, ApiResponse } from '@/types/database';

const prisma = new PrismaClient();

// GET /api/v1/kram/tags - Get all tags
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<TagResponse[]>>> {
	try {
		const tags = await prisma.tags.findMany({
			orderBy: {
				name: 'asc',
			},
		});

		const response: ApiResponse<TagResponse[]> = {
			success: true,
			data: tags.map((tag) => ({
				id: tag.id,
				image_url: tag.image_url,
				name: tag.name,
				description: tag.description,
			})),
			message: 'Tags retrieved successfully',
		};

		return NextResponse.json(response, { status: 200 });
	} catch (error) {
		console.error('Error fetching tags:', error);

		const errorResponse: ApiResponse<TagResponse[]> = {
			success: false,
			error: 'Failed to fetch tags',
			message: error instanceof Error ? error.message : 'Unknown error occurred',
		};

		return NextResponse.json(errorResponse, { status: 500 });
	}
}

// POST /api/v1/kram/tags - Create a new tag
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<TagResponse>>> {
	try {
		const body: CreateTagRequest = await request.json();

		// Validate required fields
		if (!body.name || !body.image_url || !body.description) {
			const errorResponse: ApiResponse<TagResponse> = {
				success: false,
				error: 'Missing required fields',
				message: 'name, image_url, and description are required',
			};
			return NextResponse.json(errorResponse, { status: 400 });
		}

		// Check if tag with same name already exists
		const existingTag = await prisma.tags.findFirst({
			where: {
				name: {
					equals: body.name,
					mode: 'insensitive', // Case insensitive comparison
				},
			},
		});

		if (existingTag) {
			const errorResponse: ApiResponse<TagResponse> = {
				success: false,
				error: 'Tag already exists',
				message: `A tag with the name "${body.name}" already exists`,
			};
			return NextResponse.json(errorResponse, { status: 409 });
		}

		// Create new tag
		const newTag = await prisma.tags.create({
			data: {
				name: body.name.trim(),
				image_url: body.image_url.trim(),
				description: body.description.trim(),
			},
		});

		const response: ApiResponse<TagResponse> = {
			success: true,
			data: {
				id: newTag.id,
				image_url: newTag.image_url,
				name: newTag.name,
				description: newTag.description,
			},
			message: 'Tag created successfully',
		};

		return NextResponse.json(response, { status: 201 });
	} catch (error) {
		console.error('Error creating tag:', error);

		const errorResponse: ApiResponse<TagResponse> = {
			success: false,
			error: 'Failed to create tag',
			message: error instanceof Error ? error.message : 'Unknown error occurred',
		};

		return NextResponse.json(errorResponse, { status: 500 });
	} finally {
		await prisma.$disconnect();
	}
}
