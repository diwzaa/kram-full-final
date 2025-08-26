'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Heart, Eye, Sparkles, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Image from 'next/image';

// API function to fetch gallery items
async function fetchGalleryItems(params: {
	search?: string;
	page?: number;
	limit?: number;
	sortBy?: 'create_at' | 'prompt_message';
	sortOrder?: 'asc' | 'desc';
}): Promise<ApiResponse<PaginatedGalleryResponse>> {
	const searchParams = new URLSearchParams();

	if (params.search) searchParams.set('search', params.search);
	if (params.page) searchParams.set('page', params.page.toString());
	if (params.limit) searchParams.set('limit', params.limit.toString());
	if (params.sortBy) searchParams.set('sortBy', params.sortBy);
	if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);

	try {
		const response = await fetch(`/api/v1/kram/gallery?${searchParams.toString()}`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			throw new Error(`HTTP Error ${response.status}`);
		}

		const data: ApiResponse<PaginatedGalleryResponse> = await response.json();
		return data;
	} catch (error) {
		console.error('Error fetching gallery items:', error);
		return {
			success: false,
			error: 'Failed to fetch gallery items',
			message: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}

// Gallery Card Component
interface GalleryCardProps {
	item: GalleryItem;
	onCardClick: (id: string) => void;
}

const GalleryCard: React.FC<GalleryCardProps> = ({ item, onCardClick }) => {
	const [isLiked, setIsLiked] = useState(false);
	const [viewCount] = useState(Math.floor(Math.random() * 200) + 10); // Mock view count

	const handleLikeClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		setIsLiked(!isLiked);
	};

	const outputTags = item.output_logs[0]?.output_tags?.split(',').map((tag) => tag.trim()) || [];
	const mainImage = item.output_logs[0];

	return (
		<Card className="group cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-white p-0" onClick={() => onCardClick(item.id)}>
			{/* Image Container */}
			<div className="relative aspect-square overflow-hidden bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500">
				{mainImage?.prompt_image_url ? (
					<Image
						src={mainImage.prompt_image_url}
						alt={item.prompt_message}
						className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            width={500}
            height={500}
						onError={(e) => {
							// Fallback to gradient background if image fails to load
							(e.target as HTMLImageElement).style.display = 'none';
						}}
					/>
				) : (
					<div className="w-full h-full flex items-center justify-center text-white/80">
						<Sparkles className="w-12 h-12" />
					</div>
				)}

				{/* <div className="absolute top-3 right-3">
					<Button variant="ghost" size="sm" className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white p-2 h-auto" onClick={handleLikeClick}>
						<Heart className={cn('w-4 h-4 transition-colors', isLiked ? 'fill-red-500 text-red-500' : 'text-white')} />
					</Button>
				</div> */}

				{/* Tag badge */}
				{item.tag && (
					<div className="absolute bottom-3 left-3">
						<Badge variant="secondary" className="bg-white/90 text-gray-800 font-medium">
							{item.tag.name}
						</Badge>
					</div>
				)}
			</div>

			<CardContent className="p-4">
				{/* Title */}
				<h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">{item.prompt_message || 'Untitled Creation'}</h3>

				{/* Description */}
				<p className="text-sm text-gray-600 mb-3 line-clamp-2">{mainImage?.description || 'AI-generated artwork with unique styling'}</p>

				{/* Stats */}
				{/* <div className="flex items-center justify-between mb-3">
					<div className="flex items-center space-x-4 text-sm text-gray-500">
						<div className="flex items-center space-x-1">
							<Heart className={cn('w-4 h-4', isLiked ? 'text-red-500' : '')} />
							<span>{Math.floor(Math.random() * 20) + (isLiked ? 6 : 5)}</span>
						</div>
						<div className="flex items-center space-x-1">
							<Eye className="w-4 h-4" />
							<span>{viewCount}</span>
						</div>
					</div>
					<span className="text-xs text-gray-400">{new Date(item.create_at).toLocaleDateString('th-TH')}</span>
				</div> */}

				{/* Output Tags */}
				<div className="flex flex-wrap gap-1 mb-3">
					{outputTags.slice(0, 3).map((tag, index) => (
						<Badge key={index} variant="outline" className="text-xs px-2 py-1">
							{tag}
						</Badge>
					))}
					{outputTags.length > 3 && (
						<Badge variant="outline" className="text-xs px-2 py-1 text-gray-500">
							+{outputTags.length - 3}
						</Badge>
					)}
				</div>

				{/* View Button */}
				<Button variant="outline" size="sm" className="w-full group/btn hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600">
					<span>ดูรายละเอียด</span>
					<ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover/btn:translate-x-1" />
				</Button>
			</CardContent>
		</Card>
	);
};

// Main Home Page Component
const KramHomePage: React.FC = () => {
	const router = useRouter();
	const [searchQuery, setSearchQuery] = useState('');
	const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Load initial gallery items
	useEffect(() => {
		loadGalleryItems();
	}, []);

	const loadGalleryItems = async () => {
		setLoading(true);
		setError(null);

		try {
			const response = await fetchGalleryItems({
				limit: 6,
				sortBy: 'create_at',
				sortOrder: 'desc',
			});

			if (response.success && response.data) {
				setGalleryItems(response.data.data);
			} else {
				setError(response.error || 'Failed to load gallery items');
			}
		} catch (err) {
			setError('Failed to load gallery items');
		} finally {
			setLoading(false);
		}
	};

	const handleSearch = async () => {
		if (!searchQuery.trim()) return;

		// Route to search page with query
		router.push(`/gallery/search?q=${encodeURIComponent(searchQuery.trim())}`);
	};

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			handleSearch();
		}
	};

	const handleCardClick = (id: string) => {
		router.push(`/gallery/${id}`);
	};

	const handleGenerateWithAI = () => {
		router.push('/generate');
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
			{/* Header */}
			

			{/* Hero Section */}
			<section className="py-20 px-4 text-center">
				<div className="max-w-4xl mx-auto">
					<h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
						ค้นพบและสร้างสรรค์
						<br />
						<span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">ลวดลายผ้าคราม​ไทย</span>
					</h1>
					<p className="text-lg text-gray-600 mb-12 max-w-2xl mx-auto">เก็บข้อมูลลวดลายผ่าครามดั้งเดิม และสร้างลายใหม่ด้วยเทคโนโลยี AI</p>

					{/* Search Bar */}
					<div className="max-w-2xl mx-auto mb-8">
						<div className="flex items-center bg-white rounded-full shadow-lg p-2">
							<Input
								type="text"
								placeholder="ค้นหาลวดลาย, ชื่อ, คำจำ, หรือแท็กคำค้น..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								onKeyPress={handleKeyPress}
								className="flex-1 border-none bg-transparent text-gray-900 placeholder:text-gray-500 focus-visible:ring-0 shadow-none"
							/>
							<Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6">
								<Search className="w-5 h-5 mr-2" />
								ค้นหา
							</Button>
						</div>

						{/* Quick Actions */}
						<div className="flex justify-center space-x-4 mt-6">
							<Button
								variant="outline"
								size="sm"
								className="hover:text-white rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white border-none hover:from-purple-700 hover:to-pink-700"
								onClick={handleGenerateWithAI}
							>
								<Sparkles className="w-4 h-4 mr-2" />
								สร้างลายด้วย AI
							</Button>
						</div>
					</div>
				</div>
			</section>

			{/* Featured Gallery Section */}
			<section className="py-16 px-4">
				<div className="max-w-7xl mx-auto">
					<div className="text-center mb-12">
						<h2 className="text-3xl font-bold text-gray-900 mb-4">สร้างลายผ้าด้วย AI</h2>
						<p className="text-gray-600 max-w-2xl mx-auto">ชมผลงานล่าสุดที่สร้างขึ้นด้วยเทคโนโลยี AI และรับแรงบันดาลใจสำหรับการสร้างสรรค์ของคุณเอง</p>
					</div>

					{/* Loading State */}
					{loading && (
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
							{Array.from({ length: 6 }).map((_, index) => (
								<div key={index} className="animate-pulse">
									<div className="bg-gray-200 aspect-square rounded-lg mb-4"></div>
									<div className="bg-gray-200 h-4 rounded mb-2"></div>
									<div className="bg-gray-200 h-3 rounded w-3/4 mb-2"></div>
									<div className="bg-gray-200 h-8 rounded"></div>
								</div>
							))}
						</div>
					)}

					{/* Error State */}
					{error && (
						<div className="text-center py-12">
							<p className="text-red-600 mb-4">{error}</p>
							<Button onClick={loadGalleryItems} variant="outline">
								ลองใหม่
							</Button>
						</div>
					)}

					{/* Gallery Grid */}
					{!loading && !error && galleryItems.length > 0 && (
						<>
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
								{galleryItems.map((item) => (
									<GalleryCard key={item.id} item={item} onCardClick={handleCardClick} />
								))}
							</div>

							{/* View More Button */}
							<div className="text-center">
								<Button variant="outline" size="lg" onClick={() => router.push('/gallery')} className="px-8 py-3">
									ดูผลงานทั้งหมด
									<ArrowRight className="w-5 h-5 ml-2" />
								</Button>
							</div>
						</>
					)}

					{/* Empty State */}
					{!loading && !error && galleryItems.length === 0 && (
						<div className="text-center py-12">
							<Sparkles className="w-16 h-16 text-gray-400 mx-auto mb-4" />
							<h3 className="text-xl font-semibold text-gray-900 mb-2">ยังไม่มีผลงานในแกลลอรี่</h3>
							<p className="text-gray-600 mb-6">เริ่มสร้างผลงานแรกของคุณด้วย AI กันเถอะ</p>
							<Button onClick={handleGenerateWithAI} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
								<Sparkles className="w-5 h-5 mr-2" />
								สร้างลายด้วย AI
							</Button>
						</div>
					)}
				</div>
			</section>
		</div>
	);
};

export default KramHomePage;
