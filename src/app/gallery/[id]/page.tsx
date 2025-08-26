'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Heart, Eye, Download, Share2, Sparkles, Calendar, Tag as TagIcon, Copy, ExternalLink, ImageIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// API function
async function fetchGalleryItem(id: string): Promise<ApiResponse<GalleryItem>> {
	try {
		const response = await fetch(`/api/v1/kram/gallery/${id}`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			throw new Error(`HTTP Error ${response.status}`);
		}

		const data: ApiResponse<GalleryItem> = await response.json();
		return data;
	} catch (error) {
		console.error('Error fetching gallery item:', error);
		return {
			success: false,
			error: 'Failed to fetch gallery item',
			message: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}

// Share functionality
const shareItem = async (item: GalleryItem) => {
	const shareData = {
		title: item.prompt_message || 'ลายผ้าคราม AI',
		text: item.output_logs[0]?.description || 'ลวดลายผ้าครามที่สร้างด้วย AI',
		url: window.location.href,
	};

	try {
		if (navigator.share && navigator.canShare(shareData)) {
			await navigator.share(shareData);
		} else {
			// Fallback: copy URL to clipboard
			await navigator.clipboard.writeText(window.location.href);
			toast.success('คัดลอกลิงก์แล้ว!');
		}
	} catch (error) {
		console.error('Error sharing:', error);
		// Fallback: copy URL to clipboard
		try {
			await navigator.clipboard.writeText(window.location.href);
			toast.success('คัดลอกลิงก์แล้ว!');
		} catch (clipboardError) {
			console.error('Clipboard error:', clipboardError);
			toast.error('ไม่สามารถคัดลอกลิงก์ได้');
		}
	}
};

// Download functionality
const downloadImage = (imageUrl: string, filename: string) => {
	const link = document.createElement('a');
	link.href = imageUrl;
	link.download = `${filename}.png`;
	link.target = '_blank';
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
};

// Image Component with fallback
interface ImageWithFallbackProps {
	src: string;
	alt: string;
	className?: string;
	onError?: () => void;
}

const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({ src, alt, className, onError }) => {
	const [imageError, setImageError] = useState(false);
	const [imageLoading, setImageLoading] = useState(true);

	const handleImageError = () => {
		setImageError(true);
		setImageLoading(false);
		onError?.();
	};

	const handleImageLoad = () => {
		setImageLoading(false);
	};

	if (imageError) {
		return (
			<div className={cn('bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 flex items-center justify-center', className)}>
				<div className="text-center text-white/80">
					<ImageIcon className="w-16 h-16 mx-auto mb-2" />
					<p className="text-sm">ไม่สามารถโหลดภาพได้</p>
				</div>
			</div>
		);
	}

	return (
		<div className={cn('relative', className)}>
			{imageLoading && (
				<div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
					<div className="text-gray-400">
						<ImageIcon className="w-8 h-8 animate-pulse" />
					</div>
				</div>
			)}
			<img
				src={src}
				alt={alt}
				className={cn('w-full h-full object-cover transition-opacity duration-300', imageLoading ? 'opacity-0' : 'opacity-100')}
				onError={handleImageError}
				onLoad={handleImageLoad}
			/>
		</div>
	);
};

// Main Gallery Detail Page Component
const KramGalleryDetailPage: React.FC = () => {
	const router = useRouter();
	const params = useParams();
	const id = params?.id as string;

	// State
	const [galleryItem, setGalleryItem] = useState<GalleryItem | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isLiked, setIsLiked] = useState(false);
	const [likeCount, setLikeCount] = useState(0);
	const [viewCount] = useState(Math.floor(Math.random() * 1000) + 100);

	// Load gallery item on component mount
	useEffect(() => {
		if (id) {
			loadGalleryItem(id);
		}
	}, [id]);

	const loadGalleryItem = async (itemId: string) => {
		setLoading(true);
		setError(null);

		try {
			const response = await fetchGalleryItem(itemId);

			if (response.success && response.data) {
				setGalleryItem(response.data);
				// Set random initial like count
				setLikeCount(Math.floor(Math.random() * 100) + 20);
			} else {
				setError(response.error || 'ไม่พบรายการที่ค้นหา');
			}
		} catch (err) {
			setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
		} finally {
			setLoading(false);
		}
	};

	const handleBack = () => {
		router.back();
	};

	const handleLikeToggle = () => {
		setIsLiked(!isLiked);
		setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1));
	};

	const handleShare = async () => {
		if (galleryItem) {
			await shareItem(galleryItem);
		}
	};

	const handleDownload = () => {
		if (galleryItem?.output_logs[0]?.prompt_image_url) {
			downloadImage(galleryItem.output_logs[0].prompt_image_url, `kram-pattern-${galleryItem.id}`);
			toast.success('เริ่มดาวน์โหลดแล้ว!');
		} else {
			toast.error('ไม่สามารถดาวน์โหลดได้');
		}
	};

	const copyPromptToClipboard = async () => {
		if (galleryItem?.prompt_message) {
			try {
				await navigator.clipboard.writeText(galleryItem.prompt_message);
				toast.success('คัดลอก Prompt แล้ว!');
			} catch (error) {
				console.error('Failed to copy:', error);
				toast.error('ไม่สามารถคัดลอกได้');
			}
		}
	};

	const generateSimilar = () => {
		if (galleryItem?.prompt_message) {
			const encodedPrompt = encodeURIComponent(galleryItem.prompt_message);
			router.push(`/generate?prompt=${encodedPrompt}`);
		} else {
			router.push('/generate');
		}
	};

	// Loading state
	if (loading) {
		return (
			<div className="min-h-screen bg-gray-50">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
					<div className="animate-pulse">
						<div className="flex items-center mb-8">
							<div className="bg-gray-200 w-20 h-8 rounded"></div>
						</div>
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
							<div className="bg-gray-200 aspect-square rounded-xl"></div>
							<div className="space-y-4">
								<div className="bg-gray-200 h-8 rounded w-3/4"></div>
								<div className="bg-gray-200 h-4 rounded"></div>
								<div className="bg-gray-200 h-4 rounded w-2/3"></div>
								<div className="bg-gray-200 h-20 rounded"></div>
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// Error state
	if (error || !galleryItem) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-center max-w-md mx-auto px-4">
					<div className="bg-red-50 border border-red-200 rounded-lg p-8">
						<h2 className="text-xl font-semibold text-red-800 mb-2">เกิดข้อผิดพลาด</h2>
						<p className="text-red-600 mb-4">{error || 'ไม่พบรายการที่ค้นหา'}</p>
						<div className="space-x-4">
							<Button onClick={handleBack} variant="outline">
								ย้อนกลับ
							</Button>
							<Button onClick={() => router.push('/gallery')}>ไปแกลลอรี่</Button>
						</div>
					</div>
				</div>
			</div>
		);
	}

	const mainImage = galleryItem.output_logs[0];
	const outputTags = mainImage?.output_tags?.split(',').map((tag) => tag.trim()) || [];

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Header */}
			<header className="bg-white border-b border-gray-200 sticky top-0 z-50">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center space-x-4">
							<Button variant="ghost" size="sm" onClick={handleBack} className="text-gray-600 hover:text-gray-900">
								<ArrowLeft className="w-5 h-5 mr-1" />
								ย้อนกลับ
							</Button>
							<h1 className="text-xl font-semibold text-gray-900">รายละเอียดลายผ้าคราม</h1>
						</div>
						<div className="flex items-center space-x-2">
							<Button variant="ghost" size="sm" onClick={handleLikeToggle} className="text-gray-600 hover:text-red-600">
								<Heart className={cn('w-5 h-5 mr-1 transition-colors', isLiked ? 'fill-red-500 text-red-500' : 'text-gray-600')} />
								{likeCount}
							</Button>
							<Button variant="ghost" size="sm" onClick={handleShare} className="text-gray-600 hover:text-blue-600">
								<Share2 className="w-5 h-5 mr-1" />
								แชร์
							</Button>
							<Button variant="ghost" size="sm" onClick={handleDownload} className="text-gray-600 hover:text-green-600">
								<Download className="w-5 h-5 mr-1" />
								ดาวน์โหลด
							</Button>
						</div>
					</div>
				</div>
			</header>

			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
					{/* Left Column - Image */}
					<div className="space-y-4">
						<Card className="overflow-hidden bg-white shadow-lg">
							<div className="relative aspect-square">
								{mainImage?.prompt_image_url ? (
									<ImageWithFallback src={mainImage.prompt_image_url} alt={galleryItem.prompt_message || 'ลายผ้าคราม'} className="w-full h-full" />
								) : (
									<div className="w-full h-full bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 flex items-center justify-center">
										<div className="text-center text-white/80">
											<Sparkles className="w-16 h-16 mx-auto mb-2" />
											<p>ลายผ้าคราม AI</p>
										</div>
									</div>
								)}

								{/* Overlay Actions */}
								<div className="absolute top-4 right-4 flex space-x-2">
									<Button variant="ghost" size="sm" className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white" onClick={handleLikeToggle}>
										<Heart className={cn('w-5 h-5 transition-colors', isLiked ? 'fill-red-500 text-red-500' : 'text-white')} />
									</Button>
									<Button variant="ghost" size="sm" className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white" onClick={handleDownload}>
										<Download className="w-5 h-5" />
									</Button>
								</div>

								{/* Style Tag */}
								{galleryItem.tag && (
									<div className="absolute bottom-4 left-4">
										<Badge variant="secondary" className="bg-white/90 text-gray-800 font-medium">
											{galleryItem.tag.name}
										</Badge>
									</div>
								)}
							</div>
						</Card>

						{/* Quick Actions */}
						<div className="grid grid-cols-2 gap-4">
							<Button onClick={generateSimilar} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
								<Sparkles className="w-4 h-4 mr-2" />
								สร้างลายคล้ายกัน
							</Button>
							<Button variant="outline" onClick={handleShare}>
								<ExternalLink className="w-4 h-4 mr-2" />
								แชร์ผลงาน
							</Button>
						</div>
					</div>

					{/* Right Column - Details */}
					<div className="space-y-6">
						{/* Title and Description */}
						<Card className="bg-white shadow-sm">
							<CardContent className="p-6">
								<h1 className="text-2xl font-bold text-gray-900 mb-4 leading-tight">{galleryItem.prompt_message || 'ลายผ้าคราม AI'}</h1>

								{mainImage?.description && (
									<div className="mb-6">
										<h3 className="text-sm font-medium text-gray-700 mb-2">คำอธิบายลาย</h3>
										<p className="text-gray-600 leading-relaxed">{mainImage.description}</p>
									</div>
								)}

								{/* Stats */}
								<div className="flex items-center space-x-6 text-sm text-gray-500 mb-6">
									<div className="flex items-center space-x-1">
										<Heart className={cn('w-4 h-4', isLiked ? 'text-red-500' : '')} />
										<span>{likeCount} ถูกใจ</span>
									</div>
									<div className="flex items-center space-x-1">
										<Eye className="w-4 h-4" />
										<span>{viewCount.toLocaleString()} ครั้ง</span>
									</div>
									<div className="flex items-center space-x-1">
										<Calendar className="w-4 h-4" />
										<span>
											{new Date(galleryItem.create_at).toLocaleDateString('th-TH', {
												year: 'numeric',
												month: 'long',
												day: 'numeric',
											})}
										</span>
									</div>
								</div>

								<Separator className="my-6" />

								{/* Tags */}
								<div className="space-y-4">
									{galleryItem.tag && (
										<div>
											<h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
												<TagIcon className="w-4 h-4 mr-1" />
												สไตล์ลาย
											</h3>
											<div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
												<div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex-shrink-0"></div>
												<div>
													<div className="font-medium text-gray-900">{galleryItem.tag.name}</div>
													<div className="text-sm text-gray-600">{galleryItem.tag.description}</div>
												</div>
											</div>
										</div>
									)}

									{outputTags.length > 0 && (
										<div>
											<h3 className="text-sm font-medium text-gray-700 mb-2">แท็กลาย</h3>
											<div className="flex flex-wrap gap-2">
												{outputTags.map((tag, index) => (
													<Badge
														key={index}
														variant="outline"
														className="cursor-pointer hover:bg-gray-50"
														onClick={() => router.push(`/gallery?search=${encodeURIComponent(tag)}`)}
													>
														{tag}
													</Badge>
												))}
											</div>
										</div>
									)}
								</div>
							</CardContent>
						</Card>

						{/* Prompt Details */}
						<Card className="bg-white shadow-sm">
							<CardContent className="p-6">
								<div className="flex items-center justify-between mb-3">
									<h3 className="text-sm font-medium text-gray-700">คำสั่งที่ใช้สร้าง (Prompt)</h3>
									<Button variant="ghost" size="sm" onClick={copyPromptToClipboard} className="text-blue-600 hover:text-blue-700">
										<Copy className="w-4 h-4 mr-1" />
										คัดลอก
									</Button>
								</div>
								<div className="bg-gray-50 rounded-lg p-4">
									<p className="text-gray-800 leading-relaxed">&ldquo;{galleryItem.prompt_message}&rdquo;</p>
								</div>
							</CardContent>
						</Card>

						{/* Technical Details */}
						<Card className="bg-white shadow-sm">
							<CardContent className="p-6">
								<h3 className="text-sm font-medium text-gray-700 mb-4">ข้อมูลเทคนิค</h3>
								<div className="space-y-3 text-sm">
									<div className="flex justify-between">
										<span className="text-gray-600">รหัสผลงาน:</span>
										<span className="font-mono text-gray-800">{galleryItem.id.slice(0, 8)}...</span>
									</div>
									<div className="flex justify-between">
										<span className="text-gray-600">ประเภท:</span>
										<span className="text-gray-800">AI Generated</span>
									</div>
									<div className="flex justify-between">
										<span className="text-gray-600">รูปแบบไฟล์:</span>
										<span className="text-gray-800">PNG</span>
									</div>
									<div className="flex justify-between">
										<span className="text-gray-600">วันที่สร้าง:</span>
										<span className="text-gray-800">
											{new Date(galleryItem.create_at).toLocaleDateString('th-TH', {
												year: 'numeric',
												month: 'short',
												day: 'numeric',
												hour: '2-digit',
												minute: '2-digit',
											})}
										</span>
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Action Buttons */}
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<Button onClick={() => router.push('/gallery')} variant="outline" className="w-full">
								กลับไปแกลลอรี่
							</Button>
							<Button onClick={generateSimilar} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
								<Sparkles className="w-4 h-4 mr-2" />
								สร้างลายใหม่
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default KramGalleryDetailPage;
