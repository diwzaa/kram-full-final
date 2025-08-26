'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { X, ArrowLeft, Sparkles, Image as ImageIcon, Loader2, Download, Heart, Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import Image from 'next/image';

// Types
interface TagResponse {
	id: string;
	image_url: string;
	name: string;
	description: string;
}

interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
	message?: string;
}

interface KramPatternRequest {
	prompt: string;
	tag_ids?: string[];
	dalle_options?: {
		size?: '1024x1024' | '1792x1024' | '1024x1792';
		quality?: 'standard' | 'hd';
		style?: 'vivid' | 'natural';
	};
	chat_options?: {
		model?: 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo';
		max_tokens?: number;
	};
}

interface KramPatternResponse {
	history_id: string;
	prompt_message: string;
	selected_tags: Array<{
		id: string;
		name: string;
		description: string;
	}>;
	generated_outputs: Array<{
		id: string;
		image_url: string;
		description: string;
		output_tags: string;
	}>;
	created_at: string;
}

interface GeneratedResult {
	id: string;
	image_url: string;
	description: string;
	output_tags: string;
}

// Utility Functions
const isValidUUID = (str: string): boolean => {
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	return uuidRegex.test(str);
};

const filterValidTagIds = (tagIds: string[]): string[] => {
	return tagIds.filter((id) => isValidUUID(id));
};

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
	const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

	const handleImageError = (tagId: string) => {
		setImageErrors((prev) => new Set([...prev, tagId]));
	};

	const handleImageLoad = (tagId: string) => {
		setImageErrors((prev) => {
			const newSet = new Set(prev);
			newSet.delete(tagId);
			return newSet;
		});
	};

	const validSelectedTags = selectedTags.filter((tagId) => {
		const isValid = isValidUUID(tagId);
		const tagExists = tags.some((tag) => tag.id === tagId);
		return isValid && tagExists;
	});

	return (
		<div>
			<label className="block text-sm font-medium text-gray-700 mb-3">องค์ประกอบเพิ่มเติม:</label>
            <span className="text-xs text-gray-500"><span className="text-red">*</span> องค์ประกอบเป็นเพียงตัวช่วยในการสร้างลวดลายผ้าคราม AI ภาพที่ได้อาจไม่ตรงตามที่เห็น</span>
			<TooltipProvider>
				<div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
					{tags.map((tag) => {
						const isSelected = validSelectedTags.includes(tag.id);
						const isDisabled = !isSelected && validSelectedTags.length >= maxTags;
						const hasImageError = imageErrors.has(tag.id);

						return (
							<Tooltip key={tag.id}>
								<TooltipTrigger asChild>
									<div
										className={cn('relative cursor-pointer transition-all duration-200 transform hover:scale-105', isDisabled && 'cursor-not-allowed opacity-50')}
										onClick={() => !isDisabled && onTagToggle(tag.id)}
									>
										<Card
											className={cn(
												'overflow-hidden border-2 transition-all duration-200 p-0 w-10 h-10',
												isSelected ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm',
												isDisabled && 'hover:border-gray-200 hover:shadow-none',
											)}
										>
											<CardContent className="p-0">
												<div className="relative aspect-square bg-gray-100 overflow-hidden">
													{!hasImageError ? (
														<Image
															src={tag.image_url}
															alt={tag.name}
															width={20}
															height={20}
															className="w-full h-full object-cover"
															onError={() => handleImageError(tag.id)}
															onLoad={() => handleImageLoad(tag.id)}
														/>
													) : (
														<div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100">
															<ImageIcon className="w-8 h-8" />
														</div>
													)}

													{isSelected && (
														<div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center">
															<div className="bg-blue-600 text-white rounded-full p-1">
																<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
																	<path
																		fillRule="evenodd"
																		d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
																		clipRule="evenodd"
																	/>
																</svg>
															</div>
														</div>
													)}
												</div>
											</CardContent>
										</Card>
									</div>
								</TooltipTrigger>
								<TooltipContent>
									<p>{tag.name}</p>
								</TooltipContent>
							</Tooltip>
						);
					})}
				</div>
			</TooltipProvider>

			<div className="flex justify-between items-center mt-4">
				<p className="text-xs text-gray-500">
					เลือกได้สูงสุด {maxTags} แท็ก ({validSelectedTags.length}/{maxTags})
				</p>

				{validSelectedTags.length > 0 && (
					<div className="flex flex-wrap gap-1 max-w-xs">
						{validSelectedTags.slice(0, 3).map((tagId) => {
							const tag = tags.find((t) => t.id === tagId);
							return tag ? (
								<Badge key={tagId} variant="default" className="text-xs px-2 py-1 bg-blue-100 text-blue-700">
									{tag.name}
								</Badge>
							) : null;
						})}
						{validSelectedTags.length > 3 && (
							<Badge variant="outline" className="text-xs px-2 py-1">
								+{validSelectedTags.length - 3}
							</Badge>
						)}
					</div>
				)}
			</div>

			{validSelectedTags.length > 0 && (
				<div className="mt-2">
					<Button variant="ghost" size="sm" onClick={() => validSelectedTags.forEach((tagId) => onTagToggle(tagId))} className="text-xs text-gray-500 hover:text-gray-700 p-1 h-auto">
						เคลียร์แท็กที่เลือก
					</Button>
				</div>
			)}
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
	const outputTags = result.output_tags.split(',').map((tag) => tag.trim());

	return (
		<Card className="overflow-hidden p-0">
			<div className="relative aspect-square bg-gray-100">
				{result.image_url ? (
					<Image
						width={600}
						height={800}
						src={result.image_url}
						alt={prompt}
						className="w-full h-full object-cover"
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

				<div className="absolute top-3 right-3 flex space-x-2">
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

				<div className="flex space-x-2">
					<Button variant="outline" size="sm" className="flex-1">
						แชร์
					</Button>
					{onSave && (
						<Button onClick={onSave} size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700">
							ดูรายละเอียด
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
};

// URL Parameter Utilities
const updateURLParams = (params: Record<string, string | null>) => {
	if (typeof window === 'undefined') return;

	const url = new URL(window.location.href);
	Object.entries(params).forEach(([key, value]) => {
		if (value === null || value === '') {
			url.searchParams.delete(key);
		} else {
			url.searchParams.set(key, value);
		}
	});

	window.history.replaceState({}, '', url.toString());
};

const getInitialStateFromURL = (searchParams: URLSearchParams | null) => {
	if (!searchParams) {
		return {
			prompt: '',
			tags: [],
			size: '1024x1024' as const,
			quality: 'standard' as const,
			style: 'vivid' as const,
		};
	}

	const prompt = searchParams.get('prompt');
	const decodedPrompt = prompt ? decodeURIComponent(prompt) : '';

	const tags = searchParams.get('tags');
	const decodedTags = tags ? filterValidTagIds(tags.split(',').filter(Boolean)) : [];

	return {
		prompt: decodedPrompt,
		tags: decodedTags,
		size: (searchParams.get('size') as '1024x1024' | '1792x1024' | '1024x1792') || '1024x1024',
		quality: (searchParams.get('quality') as 'standard' | 'hd') || 'standard',
		style: (searchParams.get('style') as 'vivid' | 'natural') || 'vivid',
	};
};

// Main Generate Page Component
const KramGeneratePageComponent: React.FC = () => {
	const router = useRouter();
	const searchParams = useSearchParams();

	// State
	const [prompt, setPrompt] = useState('');
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [availableTags, setAvailableTags] = useState<TagResponse[]>([]);
	const [imageSize, setImageSize] = useState<'1024x1024' | '1792x1024' | '1024x1792'>('1024x1024');
	const [imageQuality, setImageQuality] = useState<'standard' | 'hd'>('standard');
	const [imageStyle, setImageStyle] = useState<'vivid' | 'natural'>('natural');
	const [isGenerating, setIsGenerating] = useState(false);
	const [generationProgress, setGenerationProgress] = useState(0);
	const [generatedResults, setGeneratedResults] = useState<GeneratedResult[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
	const [isInitialized, setIsInitialized] = useState(false);

	// Initialize state from URL parameters
	useEffect(() => {
		const initializeFromURL = () => {
			try {
				const initialState = getInitialStateFromURL(searchParams);

				if (initialState.prompt) {
					setPrompt(initialState.prompt);
				}

				if (initialState.tags.length > 0) {
					setSelectedTags(initialState.tags);
				}

				setImageSize(initialState.size);
				setImageQuality(initialState.quality);
				setImageStyle(initialState.style);
			} catch (error) {
				// Error handling without console log
			} finally {
				setIsInitialized(true);
			}
		};

		if (searchParams && !isInitialized) {
			initializeFromURL();
		} else if (!searchParams && !isInitialized) {
			setIsInitialized(true);
		}
	}, [searchParams, isInitialized]);

	// Load tags on component mount
	useEffect(() => {
		loadTags();
	}, []);

	// Update URL when state changes (debounced)
	useEffect(() => {
		if (!isInitialized) return;

		const timeoutId = setTimeout(() => {
			updateURLParams({
				prompt: prompt.trim() || null,
				tags: selectedTags.length > 0 ? selectedTags.join(',') : null,
				size: imageSize !== '1024x1024' ? imageSize : null,
				quality: imageQuality !== 'standard' ? imageQuality : null,
				style: imageStyle !== 'vivid' ? imageStyle : null,
			});
		}, 200);

		return () => clearTimeout(timeoutId);
	}, [prompt, selectedTags, imageSize, imageQuality, imageStyle, isInitialized]);

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

	const handlePromptChange = (value: string) => {
		setPrompt(value);
	};

	const handleTagToggle = (tagId: string) => {
		if (!isValidUUID(tagId)) {
			setError(`Invalid tag ID: ${tagId}`);
			return;
		}

		setSelectedTags((prev) => {
			if (prev.includes(tagId)) {
				return prev.filter((id) => id !== tagId);
			} else if (prev.length < 5) {
				return [...prev, tagId];
			}
			return prev;
		});
	};

	const handleSizeChange = (value: '1024x1024' | '1792x1024' | '1024x1792') => {
		setImageSize(value);
	};

	const handleQualityChange = (value: 'standard' | 'hd') => {
		setImageQuality(value);
	};

	const handleStyleChange = (value: 'vivid' | 'natural') => {
		setImageStyle(value);
	};

	const handleGenerate = async () => {
		if (!prompt.trim()) {
			setError('กรุณากรอกคำอธิบายความต้องการ');
			return;
		}

		setIsGenerating(true);
		setError(null);
		setGenerationProgress(0);

		const progressInterval = setInterval(() => {
			setGenerationProgress((prev) => {
				if (prev >= 90) {
					clearInterval(progressInterval);
					return prev;
				}
				return prev + Math.random() * 15;
			});
		}, 2000);

		try {
			const validTagIds = filterValidTagIds(selectedTags);

			const request: KramPatternRequest = {
				prompt: prompt.trim(),
				tag_ids: validTagIds,
				dalle_options: {
					size: imageSize,
					quality: imageQuality,
					style: imageStyle,
				},
				chat_options: {
					model: 'gpt-4-turbo',
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
		const link = document.createElement('a');
		link.href = result.image_url;
		link.download = `kram-pattern-${result.id}.png`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	const handleClearForm = () => {
		setPrompt('');
		setSelectedTags([]);
		setImageSize('1024x1024');
		setImageQuality('standard');
		setImageStyle('vivid');
		setGeneratedResults([]);
		setError(null);
		setCurrentHistoryId(null);
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
			<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
					{/* Left Column - Form */}
					<div className="space-y-6">
						<Card className="bg-white/80 backdrop-blur-sm border-white/40">
							<CardContent className="p-6">
								{/* Header with Clear Button */}
								<div className="flex justify-between items-center mb-6">
									<h2 className="text-xl font-bold text-gray-800">สร้างลายด้วย AI</h2>
									{(prompt || selectedTags.length > 0) && (
										<Button variant="ghost" size="sm" onClick={handleClearForm} className="text-gray-500 hover:text-gray-700">
											<X className="w-4 h-4 mr-1" />
											เคลียร์
										</Button>
									)}
								</div>

								{/* Main Prompt */}
								<div className="mb-6">
									<label className="block text-sm font-medium text-gray-700 mb-2">อธิบายลายที่ต้องการ เช่น &ldquo;ลายนครธรรม ลายดอกจันทร์ ลายตะเพียน&rdquo;</label>
									<Textarea
										value={prompt}
										onChange={(e) => handlePromptChange(e.target.value)}
										placeholder="ลายนครธรรม ลายดอกจันทร์ ลายตะเพียน"
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
										<Select value={imageSize} onValueChange={handleSizeChange}>
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
										<Select value={imageQuality} onValueChange={handleQualityChange}>
											<SelectTrigger disabled={isGenerating}>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="standard">มาตรฐาน</SelectItem>
												<SelectItem value="hd">ความละเอียดสูง</SelectItem>
											</SelectContent>
										</Select>
									</div>

									<div className="sm:col-span-2">
										<label className="block text-sm font-medium text-gray-700 mb-1">สไตล์</label>
										<Select value={imageStyle} onValueChange={handleStyleChange}>
											<SelectTrigger disabled={isGenerating}>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="natural">เป็นธรรมชาติ</SelectItem>
												<SelectItem value="vivid">สีสันสดใส</SelectItem>
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

const KramGeneratePage = () => {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<KramGeneratePageComponent />
		</Suspense>
	);
};

export default KramGeneratePage;
