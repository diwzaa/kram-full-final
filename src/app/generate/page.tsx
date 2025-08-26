'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, ArrowLeft, Sparkles, Image as ImageIcon, Loader2, Download, Heart, Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Image from 'next/image';
import { cn } from '@/lib/utils';

// API Functions
async function fetchTags(): Promise<ApiResponse<TagResponse[]>> {
	try {
		const response = await fetch('/api/v1/kram/tags', {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			throw new Error(`HTTP Error ${response.status}`);
		}

		const data: ApiResponse<TagResponse[]> = await response.json();
		return data;
	} catch (error) {
		console.error('Error fetching tags:', error);
		return {
			success: false,
			error: 'Failed to fetch tags',
			message: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}

async function generateKramPattern(request: KramPatternRequest): Promise<ApiResponse<KramPatternResponse>> {
	try {
		const response = await fetch('/api/v1/kram/generate/kram-pattern', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(request),
		});

		if (!response.ok) {
			throw new Error(`HTTP Error ${response.status}`);
		}

		const data: ApiResponse<KramPatternResponse> = await response.json();
		return data;
	} catch (error) {
		console.error('Error generating pattern:', error);
		return {
			success: false,
			error: 'Failed to generate pattern',
			message: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}

// Tag Selection Component
interface TagSelectorProps {
	tags: TagResponse[];
	selectedTags: string[];
	onTagToggle: (tagId: string) => void;
	maxTags?: number;
}

const TagSelector: React.FC<TagSelectorProps> = ({ tags, selectedTags, onTagToggle, maxTags = 5 }) => {
	return (
		<div>
			<label className="block text-sm font-medium text-gray-700 mb-3">ตัวอย่าง Prompt:</label>
			<div className="flex flex-wrap gap-2">
				{tags.map((tag) => (
					<Button
						key={tag.id}
						variant={selectedTags.includes(tag.id) ? 'default' : 'outline'}
						size="sm"
						onClick={() => onTagToggle(tag.id)}
						disabled={!selectedTags.includes(tag.id) && selectedTags.length >= maxTags}
						className={cn('transition-all duration-200', selectedTags.includes(tag.id) ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:bg-gray-50')}
					>
						{tag.name}
					</Button>
				))}
			</div>
			<p className="text-xs text-gray-500 mt-2">
				เลือกได้สูงสุด {maxTags} แท็ก ({selectedTags.length}/{maxTags})
			</p>
		</div>
	);
};

// Generated Result Component
interface GeneratedResultProps {
	result: GeneratedResult;
	prompt: string;
	onSave?: () => void;
	onDownload?: () => void;
}

const GeneratedResultCard: React.FC<GeneratedResultProps> = ({ result, prompt, onSave, onDownload }) => {
	const [isLiked, setIsLiked] = useState(false);
	const outputTags = result.output_tags.split(',').map((tag) => tag.trim());

	return (
		<Card className="overflow-hidden p-0">
			<div className="relative aspect-square bg-gray-100">
				{result.image_url ? (
					<Image
						src={result.image_url}
						alt={prompt}
						className="w-full h-full object-cover"
                        width={600}
                        height={800}
						onError={(e) => {
							(e.target as HTMLImageElement).src = '/placeholder-image.png';
						}}
					/>
				) : (
					<div className="w-full h-full flex items-center justify-center text-gray-400">
						<ImageIcon className="w-16 h-16" />
						<span className="ml-2">600×800</span>
					</div>
				)}

				{/* Action buttons */}
				<div className="absolute top-3 right-3 flex space-x-2">
					{/* <Button variant="ghost" size="sm" className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white p-2 h-auto" onClick={() => setIsLiked(!isLiked)}>
						<Heart className={cn('w-4 h-4 transition-colors', isLiked ? 'fill-red-500 text-red-500' : 'text-white')} />
					</Button> */}
					{onDownload && (
						<Button variant="ghost" size="sm" className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white p-2 h-auto" onClick={onDownload}>
							<Download className="w-4 h-4" />
						</Button>
					)}
				</div>
			</div>

			<CardContent className="p-4">
				<h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{prompt}</h3>

				<p className="text-sm text-gray-600 mb-3 line-clamp-3">{result.description}</p>

				{/* Output Tags */}
				<div className="flex flex-wrap gap-1 mb-4">
					{outputTags.slice(0, 4).map((tag, index) => (
						<Badge key={index} variant="outline" className="text-xs px-2 py-1">
							{tag}
						</Badge>
					))}
					{outputTags.length > 4 && (
						<Badge variant="outline" className="text-xs px-2 py-1 text-gray-500">
							+{outputTags.length - 4}
						</Badge>
					)}
				</div>

				{/* Stats */}
				{/* <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
					<div className="flex items-center space-x-4">
						<div className="flex items-center space-x-1">
							<Heart className={cn('w-4 h-4', isLiked ? 'text-red-500' : '')} />
							<span>{Math.floor(Math.random() * 20) + (isLiked ? 6 : 5)}</span>
						</div>
						<div className="flex items-center space-x-1">
							<Eye className="w-4 h-4" />
							<span>{Math.floor(Math.random() * 100) + 10}</span>
						</div>
					</div>
					<span className="text-xs">เมื่อสักครู่</span>
				</div> */}

				{/* Action Buttons */}
				<div className="flex space-x-2">
					<Button variant="outline" size="sm" className="flex-1">
						แชร์
					</Button>
					{onSave && (
						<Button onClick={onSave} size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700">
							บันทึก
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
};

// Main Generate Page Component
const KramGeneratePage: React.FC = () => {
	const router = useRouter();

	// State
	const [prompt, setPrompt] = useState('');
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [availableTags, setAvailableTags] = useState<TagResponse[]>([]);
	const [imageSize, setImageSize] = useState<'1024x1024' | '1792x1024' | '1024x1792'>('1024x1024');
	const [imageQuality, setImageQuality] = useState<'standard' | 'hd'>('standard');
	const [imageStyle, setImageStyle] = useState<'vivid' | 'natural'>('vivid');

	// Generation state
	const [isGenerating, setIsGenerating] = useState(false);
	const [generationProgress, setGenerationProgress] = useState(0);
	const [generatedResults, setGeneratedResults] = useState<GeneratedResult[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);

	// Load tags on component mount
	useEffect(() => {
		loadTags();
	}, []);

	const loadTags = async () => {
		try {
			const response = await fetchTags();
			if (response.success && response.data) {
				setAvailableTags(response.data);
			} else {
				setError('ไม่สามารถโหลดแท็กได้');
			}
		} catch (err) {
			setError('เกิดข้อผิดพลาดในการโหลดแท็ก');
		}
	};

	const handleTagToggle = (tagId: string) => {
		setSelectedTags((prev) => {
			if (prev.includes(tagId)) {
				return prev.filter((id) => id !== tagId);
			} else if (prev.length < 5) {
				return [...prev, tagId];
			}
			return prev;
		});
	};

	const handleGenerate = async () => {
		if (!prompt.trim()) {
			setError('กรุณากรอกคำอธิบายความต้องการ');
			return;
		}

		setIsGenerating(true);
		setError(null);
		setGenerationProgress(0);

		// Simulate progress
		const progressInterval = setInterval(() => {
			setGenerationProgress((prev) => {
				if (prev >= 90) {
					clearInterval(progressInterval);
					return prev;
				}
				return prev + Math.random() * 15;
			});
		}, 1000);

		try {
			const request: KramPatternRequest = {
				prompt: prompt.trim(),
				tag_ids: selectedTags,
				dalle_options: {
					size: imageSize,
					quality: imageQuality,
					style: imageStyle,
				},
				chat_options: {
					model: 'gpt-4-turbo',
					max_tokens: 1000,
				},
			};

			const response = await generateKramPattern(request);
			clearInterval(progressInterval);
			setGenerationProgress(100);

			if (response.success && response.data) {
				setGeneratedResults(response.data.generated_outputs);
				setCurrentHistoryId(response.data.history_id);
			} else {
				setError(response.error || 'การสร้างลายผิดพลาด');
			}
		} catch (err) {
			clearInterval(progressInterval);
			setError('เกิดข้อผิดพลาดในการสร้างลาย');
		} finally {
			setIsGenerating(false);
			setTimeout(() => setGenerationProgress(0), 2000);
		}
	};

	const handleSaveResult = () => {
		if (currentHistoryId) {
			router.push(`/gallery/${currentHistoryId}`);
		}
	};

	const handleDownloadResult = (result: GeneratedResult) => {
		// Create download link
		const link = document.createElement('a');
		link.href = result.image_url;
		link.download = `kram-pattern-${result.id}.png`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
			
			<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
					{/* Left Column - Form */}
					<div className="space-y-6">
						<Card className="bg-white/80 backdrop-blur-sm border-white/40">
							<CardContent className="p-6">
								{/* Main Prompt */}
								<div className="mb-6">
									<label className="block text-sm font-medium text-gray-700 mb-2">อธิบายลายที่ต้องการ เช่น &ldquo;ลายขดน้ำครองเป็น ลายมอกอินขับของงคลามวขาวดูอยความคาดราม&rdquo;</label>
									<Textarea
										value={prompt}
										onChange={(e) => setPrompt(e.target.value)}
										placeholder="อธิบายลายที่ต้องการ เช่น ลายขครองรม ลายดอกจันตร์ ลายตะพาบิน"
										className="min-h-[120px] resize-none text-gray-700"
										disabled={isGenerating}
									/>
								</div>

								{/* Tag Selection */}
								{availableTags.length > 0 && (
									<div className="mb-6">
										<TagSelector tags={availableTags} selectedTags={selectedTags} onTagToggle={handleTagToggle} maxTags={5} />
									</div>
								)}

								{/* Image Options */}
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-1">ขนาดภาพ</label>
										<Select value={imageSize} onValueChange={(value: any) => setImageSize(value)}>
											<SelectTrigger disabled={isGenerating}>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="1024x1024">สี่เหลี่ยม (1024×1024)</SelectItem>
												<SelectItem value="1792x1024">แนวนอน (1792×1024)</SelectItem>
												<SelectItem value="1024x1792">แนวตั้ง (1024×1792)</SelectItem>
											</SelectContent>
										</Select>
									</div>

									<div>
										<label className="block text-sm font-medium text-gray-700 mb-1">คุณภาพ</label>
										<Select value={imageQuality} onValueChange={(value: any) => setImageQuality(value)}>
											<SelectTrigger disabled={isGenerating}>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="standard">มาตรฐาน</SelectItem>
												<SelectItem value="hd">ความละเอียดสูง</SelectItem>
											</SelectContent>
										</Select>
									</div>

									<div>
										<label className="block text-sm font-medium text-gray-700 mb-1">สไตล์</label>
										<Select value={imageStyle} onValueChange={(value: any) => setImageStyle(value)}>
											<SelectTrigger disabled={isGenerating}>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="vivid">สีสันสดใส</SelectItem>
												<SelectItem value="natural">เป็นธรรมชาติ</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>

								{/* Error Display */}
								{error && (
									<div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
										<p className="text-red-600 text-sm">{error}</p>
									</div>
								)}

								{/* Generate Button */}
								<Button
									onClick={handleGenerate}
									disabled={!prompt.trim() || isGenerating}
									className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
									size="lg"
								>
									{isGenerating ? (
										<>
											<Loader2 className="w-5 h-5 mr-2 animate-spin" />
											กำลังสร้าง...
										</>
									) : (
										<>
											<Sparkles className="w-5 h-5 mr-2" />
											สร้างลายด้วย AI
										</>
									)}
								</Button>

								{/* Progress Bar */}
								{isGenerating && (
									<div className="mt-4">
										<div className="flex justify-between text-sm text-gray-600 mb-1">
											<span>กำลังประมวลผล</span>
											<span>{Math.round(generationProgress)}%</span>
										</div>
										<div className="w-full bg-gray-200 rounded-full h-2">
											<div className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-300" style={{ width: `${generationProgress}%` }} />
										</div>
									</div>
								)}
							</CardContent>
						</Card>
					</div>

					{/* Right Column - Results */}
					<div className="space-y-6">
						{generatedResults.length > 0 ? (
							<div className="space-y-6">
								{generatedResults.map((result) => (
									<GeneratedResultCard key={result.id} result={result} prompt={prompt} onSave={handleSaveResult} onDownload={() => handleDownloadResult(result)} />
								))}
							</div>
						) : (
							<Card className="bg-white/40 border-dashed border-2 border-gray-300 p-0">
								<CardContent className="p-8 text-center">
									<ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
									<h3 className="text-lg font-medium text-gray-700 mb-2">รอผลการสร้าง</h3>
									<p className="text-gray-500 mb-4">กรอกคำอธิบายและกดปุ่ม &ldquo;สร้างลายด้วย AI&rdquo; เพื่อเริ่มต้น</p>
								</CardContent>
							</Card>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default KramGeneratePage;
