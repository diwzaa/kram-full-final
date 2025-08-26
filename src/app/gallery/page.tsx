'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Filter, Grid, List, SlidersHorizontal, Heart, Eye, Sparkles, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import Image from 'next/image';

// API function
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
	viewMode: 'grid' | 'list';
}

const GalleryCard: React.FC<GalleryCardProps> = ({ item, onCardClick, viewMode }) => {
	const [isLiked, setIsLiked] = useState(false);
	const [viewCount] = useState(Math.floor(Math.random() * 500) + 50);

	const handleLikeClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		setIsLiked(!isLiked);
	};

	const outputTags = item.output_logs[0]?.output_tags?.split(',').map((tag) => tag.trim()) || [];
	const mainImage = item.output_logs[0];

	if (viewMode === 'list') {
		return (
			<Card className="cursor-pointer hover:shadow-lg transition-all duration-300 bg-white border-0 shadow-sm" onClick={() => onCardClick(item.id)}>
				<CardContent className="p-6">
					<div className="flex items-start space-x-6">
						{/* Image */}
						<div className="flex-shrink-0 w-32 h-32 bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 rounded-xl overflow-hidden">
							{mainImage?.prompt_image_url ? (
								<Image
									width={600}
									height={600}
									src={mainImage.prompt_image_url}
									alt={item.prompt_message}
									className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
									onError={(e) => {
										(e.target as HTMLImageElement).style.display = 'none';
									}}
								/>
							) : (
								<div className="w-full h-full flex items-center justify-center text-white/80">
									<Sparkles className="w-8 h-8" />
								</div>
							)}
						</div>

						{/* Content */}
						<div className="flex-1 min-w-0">
							<div className="flex items-start justify-between">
								<div className="flex-1">
									<h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2 hover:text-blue-600 transition-colors">{item.prompt_message || 'ลายผ้าคราม AI'}</h3>
									<p className="text-sm text-gray-600 mb-4 line-clamp-2">{mainImage?.description || 'ลวดลายผ้าครามที่สร้างด้วย AI ที่มีเอกลักษณ์และความสวยงาม'}</p>
								</div>

								{/* <Button variant="ghost" size="sm" className="ml-4" onClick={handleLikeClick}>
									<Heart className={cn('w-5 h-5 transition-colors', isLiked ? 'fill-red-500 text-red-500' : 'text-gray-400')} />
								</Button> */}
							</div>

							{/* Tags */}
							<div className="flex flex-wrap gap-2 mb-4">
								{item.tag && (
									<Badge variant="secondary" className="bg-blue-100 text-blue-800 font-medium">
										{item.tag.name}
									</Badge>
								)}
								{outputTags.slice(0, 4).map((tag, index) => (
									<Badge key={index} variant="outline" className="text-xs">
										{tag}
									</Badge>
								))}
								{outputTags.length > 4 && (
									<Badge variant="outline" className="text-xs text-gray-500">
										+{outputTags.length - 4}
									</Badge>
								)}
							</div>

							<div className="flex items-center justify-between">
								<div className="flex items-center space-x-6 text-sm text-gray-500">
									{/* <div className="flex items-center space-x-1">
										<Heart className={cn('w-4 h-4', isLiked ? 'text-red-500' : '')} />
										<span>{Math.floor(Math.random() * 50) + (isLiked ? 11 : 10)}</span>
									</div>
									<div className="flex items-center space-x-1">
										<Eye className="w-4 h-4" />
										<span>{viewCount.toLocaleString()}</span>
									</div> */}
									<span className="text-xs">
										{new Date(item.create_at).toLocaleDateString('th-TH', {
											year: 'numeric',
											month: 'short',
											day: 'numeric',
										})}
									</span>
								</div>
								<Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
									ดูรายละเอียด
									<ArrowRight className="w-4 h-4 ml-1" />
								</Button>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	// Grid view
	return (
		<Card className="group cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-white border-0 shadow-sm p-0" onClick={() => onCardClick(item.id)}>
			<div className="relative aspect-square overflow-hidden bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500">
				{mainImage?.prompt_image_url ? (
					<Image
						width={600}
						height={800}
						src={mainImage.prompt_image_url}
						alt={item.prompt_message}
						className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
						onError={(e) => {
							(e.target as HTMLImageElement).style.display = 'none';
						}}
					/>
				) : (
					<div className="w-full h-full flex items-center justify-center text-white/80">
						<Sparkles className="w-12 h-12" />
					</div>
				)}

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
				<h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">{item.prompt_message || 'ลายผ้าคราม AI'}</h3>

				{/* Description */}
				<p className="text-sm text-gray-600 mb-3 line-clamp-2">{mainImage?.description || 'ลวดลายผ้าครามที่สร้างด้วย AI'}</p>

				{/* Stats */}
				{/* <div className="flex items-center justify-between mb-3">
					<div className="flex items-center space-x-4 text-sm text-gray-500">
						<div className="flex items-center space-x-1">
							<Heart className={cn('w-4 h-4', isLiked ? 'text-red-500' : '')} />
							<span>{Math.floor(Math.random() * 30) + (isLiked ? 6 : 5)}</span>
						</div>
						<div className="flex items-center space-x-1">
							<Eye className="w-4 h-4" />
							<span>{Math.floor(viewCount / 10)}</span>
						</div>
					</div>
					<span className="text-xs text-gray-400">
						{new Date(item.create_at).toLocaleDateString('th-TH', {
							day: 'numeric',
							month: 'short',
						})}
					</span>
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
			</CardContent>
		</Card>
	);
};

// Main Gallery Page Component
const KramGalleryPage: React.FC = () => {
	const router = useRouter();
	const searchParams = useSearchParams();

	// State
	const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
	const [currentPage, setCurrentPage] = useState(1);
	const [sortBy, setSortBy] = useState<'create_at' | 'prompt_message'>('create_at');
	const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
	const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
	const [itemsPerPage, setItemsPerPage] = useState(12);

	// Data state
	const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
	const [pagination, setPagination] = useState<PaginatedGalleryResponse['pagination'] | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Load gallery items on component mount and when parameters change
	useEffect(() => {
		loadGalleryItems();
	}, [currentPage, sortBy, sortOrder, itemsPerPage]);

	// Handle search from URL params
	useEffect(() => {
		const search = searchParams.get('search');
		if (search) {
			setSearchQuery(search);
			performSearch(search, 1);
		} else {
			loadGalleryItems();
		}
	}, [searchParams]);

	const loadGalleryItems = async (page: number = currentPage) => {
		setLoading(true);
		setError(null);

		try {
			const response = await fetchGalleryItems({
				search: searchQuery || undefined,
				page,
				limit: itemsPerPage,
				sortBy,
				sortOrder,
			});

			if (response.success && response.data) {
				setGalleryItems(response.data.data);
				setPagination(response.data.pagination);
				setCurrentPage(page);
			} else {
				setError(response.error || 'ไม่สามารถโหลดแกลลอรี่ได้');
				setGalleryItems([]);
				setPagination(null);
			}
		} catch (err) {
			setError('เกิดข้อผิดพลาดในการโหลดแกลลอรี่');
			setGalleryItems([]);
			setPagination(null);
		} finally {
			setLoading(false);
		}
	};

	const performSearch = async (query: string, page: number = 1) => {
		setSearchQuery(query);

		if (query.trim()) {
			// Update URL
			const newSearchParams = new URLSearchParams(searchParams.toString());
			newSearchParams.set('search', query);
			router.replace(`/gallery?${newSearchParams.toString()}`);
		} else {
			// Remove search param
			const newSearchParams = new URLSearchParams(searchParams.toString());
			newSearchParams.delete('search');
			router.replace(`/gallery${newSearchParams.toString() ? `?${newSearchParams.toString()}` : ''}`);
		}

		loadGalleryItems(page);
	};

	const handleSearch = () => {
		performSearch(searchQuery, 1);
	};

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			handleSearch();
		}
	};

	const handlePageChange = (newPage: number) => {
		loadGalleryItems(newPage);
		window.scrollTo({ top: 0, behavior: 'smooth' });
	};

	const handleSortChange = (newSortBy: string) => {
		setSortBy(newSortBy as 'create_at' | 'prompt_message');
	};

	const handleSortOrderChange = (newOrder: string) => {
		setSortOrder(newOrder as 'asc' | 'desc');
	};

	const handleCardClick = (id: string) => {
		router.push(`/gallery/${id}`);
	};

	const clearSearch = () => {
		setSearchQuery('');
		performSearch('', 1);
	};

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Header */}
			<header className="bg-white border-b border-gray-200 sticky top-0 z-50">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center space-x-4">
							<Button
								variant="outline"
								onClick={() => router.push('/generate')}
								className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-none hover:from-purple-700 hover:to-pink-700"
							>
								<Sparkles className="w-4 h-4 mr-2" />
								สร้างลายใหม่
							</Button>
							<div className="flex items-center space-x-2">
								<Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('grid')}>
									<Grid className="w-4 h-4" />
								</Button>
								<Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')}>
									<List className="w-4 h-4" />
								</Button>
							</div>
						</div>
					</div>
				</div>
			</header>

			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				{/* Page Title */}
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-gray-900 mb-4">แกลลอรี่ลวดลายผ้าคราม</h1>
					<p className="text-gray-600 max-w-2xl">สำรวจคอลเลกชันลวดลายผ้าครามที่สร้างด้วย AI และลวดลายดั้งเดิมที่เก็บรวบรวมมาเพื่อเป็นแรงบันดาลใจ</p>
				</div>

				{/* Search and Filters */}
				<div className="mb-8">
					<div className="flex items-center bg-white rounded-lg shadow-sm border border-gray-200 p-2 mb-4">
						<Search className="w-5 h-5 text-gray-400 ml-2" />
						<Input
							type="text"
							placeholder="ค้นหาด้วยชื่อลาย, แท็ก, หรือคำอธิบาย..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							onKeyPress={handleKeyPress}
							className="flex-1 border-none shadow-none bg-transparent text-gray-900 placeholder:text-gray-500 focus-visible:ring-0"
						/>
						{searchQuery && (
							<Button variant="ghost" size="sm" onClick={clearSearch} className="text-gray-400 hover:text-gray-600 mr-2">
								×
							</Button>
						)}
						<Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700 text-white" disabled={loading}>
							ค้นหา
						</Button>
					</div>

					{/* Filters Bar */}
					<div className="flex items-center justify-between">
						<div className="flex items-center space-x-4">
							{pagination && (
								<span className="text-sm text-gray-600">
									{pagination.totalItems.toLocaleString()} ผลงาน
									{searchQuery && ` จากการค้นหา "${searchQuery}"`}
								</span>
							)}
						</div>

						<div className="flex items-center space-x-4">
							{/* Sort Controls */}
							<div className="flex items-center space-x-2">
								<span className="text-sm text-gray-600">เรียงตาม:</span>
								<Select value={sortBy} onValueChange={handleSortChange}>
									<SelectTrigger className="w-32 h-8 text-sm">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="create_at">วันที่สร้าง</SelectItem>
										<SelectItem value="prompt_message">ชื่อผลงาน</SelectItem>
									</SelectContent>
								</Select>
								<Select value={sortOrder} onValueChange={handleSortOrderChange}>
									<SelectTrigger className="w-24 h-8 text-sm">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="desc">ใหม่-เก่า</SelectItem>
										<SelectItem value="asc">เก่า-ใหม่</SelectItem>
									</SelectContent>
								</Select>
							</div>

							{/* Advanced Filters */}
							<Sheet>
								<SheetTrigger asChild>
									<Button variant="outline" size="sm">
										<SlidersHorizontal className="w-4 h-4 mr-2" />
										ตัวกรอง
									</Button>
								</SheetTrigger>
								<SheetContent>
									<SheetHeader>
										<SheetTitle>ตัวกรองแกลลอรี่</SheetTitle>
										<SheetDescription>ปรับแต่งการแสดงผลตามความต้องการ</SheetDescription>
									</SheetHeader>
									<div className="py-6 space-y-4">
										<div>
											<label className="text-sm font-medium">จำนวนต่อหน้า</label>
											<Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(parseInt(value))}>
												<SelectTrigger className="w-full mt-1">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="12">12 รายการ</SelectItem>
													<SelectItem value="24">24 รายการ</SelectItem>
													<SelectItem value="48">48 รายการ</SelectItem>
												</SelectContent>
											</Select>
										</div>
									</div>
								</SheetContent>
							</Sheet>
						</div>
					</div>
				</div>

				{/* Loading State */}
				{loading && (
					<div className={cn('grid gap-6 mb-8', viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1')}>
						{Array.from({ length: itemsPerPage }).map((_, index) => (
							<div key={index} className="animate-pulse">
								{viewMode === 'grid' ? (
									<Card className="overflow-hidden p-0">
										<div className="bg-gray-200 aspect-square"></div>
										<CardContent className="p-4">
											<div className="bg-gray-200 h-4 rounded mb-2"></div>
											<div className="bg-gray-200 h-3 rounded w-3/4 mb-2"></div>
											<div className="bg-gray-200 h-3 rounded w-1/2"></div>
										</CardContent>
									</Card>
								) : (
									<Card>
										<CardContent className="p-6">
											<div className="flex space-x-6">
												<div className="bg-gray-200 w-32 h-32 rounded-xl"></div>
												<div className="flex-1 space-y-2">
													<div className="bg-gray-200 h-6 rounded"></div>
													<div className="bg-gray-200 h-4 rounded w-3/4"></div>
													<div className="bg-gray-200 h-4 rounded w-1/2"></div>
												</div>
											</div>
										</CardContent>
									</Card>
								)}
							</div>
						))}
					</div>
				)}

				{/* Error State */}
				{error && !loading && (
					<div className="text-center py-12">
						<div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md mx-auto">
							<p className="text-red-600 mb-4">{error}</p>
							<Button onClick={() => loadGalleryItems(currentPage)} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50">
								ลองใหม่
							</Button>
						</div>
					</div>
				)}

				{/* Gallery Grid/List */}
				{!loading && !error && galleryItems.length > 0 && (
					<>
						<div className={cn('grid gap-6 mb-8', viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1')}>
							{galleryItems.map((item) => (
								<GalleryCard key={item.id} item={item} onCardClick={handleCardClick} viewMode={viewMode} />
							))}
						</div>

						{/* Pagination */}
						{pagination && pagination.totalPages > 1 && (
							<div className="flex items-center justify-center space-x-2">
								<Button variant="outline" onClick={() => handlePageChange(currentPage - 1)} disabled={!pagination.hasPrev || loading} size="sm">
									ก่อนหน้า
								</Button>

								{/* Page numbers */}
								<div className="flex items-center space-x-1">
									{Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
										const pageNum = Math.max(1, Math.min(pagination.totalPages - 4, currentPage - 2)) + i;

										if (pageNum > pagination.totalPages) return null;

										return (
											<Button
												key={pageNum}
												variant={currentPage === pageNum ? 'default' : 'outline'}
												onClick={() => handlePageChange(pageNum)}
												size="sm"
												className="w-8 h-8 p-0"
												disabled={loading}
											>
												{pageNum}
											</Button>
										);
									})}

									{pagination.totalPages > 5 && currentPage < pagination.totalPages - 2 && (
										<>
											<span className="text-gray-500">...</span>
											<Button variant="outline" onClick={() => handlePageChange(pagination.totalPages)} size="sm" className="w-8 h-8 p-0" disabled={loading}>
												{pagination.totalPages}
											</Button>
										</>
									)}
								</div>

								<Button variant="outline" onClick={() => handlePageChange(currentPage + 1)} disabled={!pagination.hasNext || loading} size="sm">
									ถัดไป
								</Button>
							</div>
						)}
					</>
				)}

				{/* Empty State */}
				{!loading && !error && galleryItems.length === 0 && (
					<div className="text-center py-12">
						<div className="bg-white border border-gray-200 rounded-lg p-8 max-w-md mx-auto">
							<Sparkles className="w-16 h-16 text-gray-400 mx-auto mb-4" />
							<h3 className="text-xl font-semibold text-gray-900 mb-2">{searchQuery ? 'ไม่พบผลการค้นหา' : 'ยังไม่มีผลงานในแกลลอรี่'}</h3>
							<p className="text-gray-600 mb-6">{searchQuery ? `ไม่พบผลลัพธ์สำหรับ "${searchQuery}" ลองใช้คำค้นหาอื่น` : 'เริ่มสร้างผลงานแรกของคุณด้วย AI กันเถอะ'}</p>
							<div className="space-y-3">
								{searchQuery ? (
									<div className="flex flex-wrap gap-2 justify-center">
										<Button variant="outline" size="sm" onClick={() => performSearch('ลายครกเคลื่อน', 1)}>
											ลายครกเคลื่อน
										</Button>
										<Button variant="outline" size="sm" onClick={() => performSearch('ลายดอกไม้', 1)}>
											ลายดอกไม้
										</Button>
										<Button variant="outline" size="sm" onClick={() => performSearch('ลายไทย', 1)}>
											ลายไทย
										</Button>
									</div>
								) : (
									<Button onClick={() => router.push('/generate')} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
										<Sparkles className="w-5 h-5 mr-2" />
										สร้างลายด้วย AI
									</Button>
								)}
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default KramGalleryPage;
