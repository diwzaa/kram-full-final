// Optimized Chat Helper for Kram Pattern System - Fixed Thai Language Support
import { getClient, logger, withRetry } from './open-ai';

// Interfaces
export interface Message {
	readonly role: 'system' | 'user' | 'assistant';
	readonly content: string;
	readonly refusal?: string | null;
}

interface ChatCompletion {
	readonly id: string;
	readonly choices: ReadonlyArray<{
		readonly message: {
			readonly content: string;
			readonly refusal?: string | null;
		};
		readonly finish_reason: string;
	}>;
	readonly usage?: {
		readonly prompt_tokens: number;
		readonly completion_tokens: number;
		readonly total_tokens: number;
	};
}

export interface ChatResult {
	readonly message: Message;
	readonly usage?: {
		readonly prompt_tokens: number;
		readonly completion_tokens: number;
		readonly total_tokens: number;
	};
	readonly response_time: number;
	readonly finish_reason: string;
}

// Custom HTTP Exception class
export class HTTPException extends Error {
	public readonly statusCode: number;
	public readonly detail: string;

	constructor(statusCode: number, detail: string) {
		super(detail);
		this.name = 'HTTPException';
		this.statusCode = statusCode;
		this.detail = detail;
		// V8 optimization: maintain consistent object shape
		Object.setPrototypeOf(this, HTTPException.prototype);
	}
}

// Pre-allocated objects for better memory efficiency
const SYSTEM_MESSAGE_TEMPLATE = {
	role: 'system' as const,
	refusal: null,
} as const;

const ASSISTANT_RESPONSE_TEMPLATE = {
	role: 'assistant' as const,
	refusal: null,
} as const;

// System prompts for different Kram Pattern use cases - Updated for Thai language
export const SYSTEM_PROMPTS = {
	IMAGE_DESCRIPTION: `คุณเป็นนักวิจารณ์ศิลปะผู้เชี่ยวชาญและนักวิเคราะห์ภาพ สร้างคำอธิบายที่น่าสนใจและมีรายละเอียดของภาพที่สร้างขึ้น ที่จับภาพองค์ประกอบทางภาพ สไตล์ศิลปะ อารมณ์ และผลกระทบเชิงสร้างสรรค์ เน้นสิ่งที่ทำให้แต่ละภาพมีความเฉพาะตัวและดึงดูดใจสำหรับผู้ชมแกลเลอรี่เชิงสร้างสรรค์ ตอบเป็นภาษาไทยเสมอ`,

	TAG_GENERATION: `คุณเป็นผู้เชี่ยวชาญการจัดหมวดหมู่เนื้อหาเชิงสร้างสรรค์ สร้างแท็กที่เกี่ยวข้องและค้นหาได้สำหรับภาพตามเนื้อหา สไตล์ และองค์ประกอบทางศิลปะ ให้แท็กที่กระชับและมีประโยชน์ที่ช่วยให้ผู้ใช้ค้นหาและจัดระเบียบเนื้อหาเชิงสร้างสรรค์ ตอบเป็นภาษาไทยเสมอ`,

	PROMPT_ENHANCEMENT: `คุณเป็นวิศวกรพรอมต์เชิงสร้างสรรค์ที่เชี่ยวชาญด้านการสร้างภาพ ปรับปรุงพรอมต์ของผู้ใช้ให้มีความเฉพาะเจาะจงมากขึ้น มีการบรรยายภาพที่ชัดเจน และเหมาะสมสำหรับการสร้างภาพด้วย AI ในขณะที่ยังคงเจตนาเดิมของผู้ใช้`,

	GENERAL_ASSISTANT: `คุณเป็นผู้ช่วยที่มีประโยชน์ที่เชี่ยวชาญด้านศิลปะเชิงสร้างสรรค์และการสร้างภาพ ให้คำตอบที่ชัดเจนและให้ข้อมูลในขณะที่รักษาโทนเสียงที่สร้างสรรค์และสร้างแรงบันดาลใจ ตอบเป็นภาษาไทยเสมอ`,
} as const;

/**
 * Validate message content
 */
function validateMessage(message: Message): { valid: boolean; error?: string } {
	if (!message.content || message.content.trim().length === 0) {
		return { valid: false, error: 'Message content cannot be empty' };
	}

	if (message.content.length > 8000) {
		return { valid: false, error: 'Message content too long (max 8000 characters)' };
	}

	if (!['system', 'user', 'assistant'].includes(message.role)) {
		return { valid: false, error: 'Invalid message role' };
	}

	return { valid: true };
}

/**
 * Estimate token count (rough approximation) - Adjusted for Thai language
 */
function estimateTokenCount(text: string): number {
	// Thai text typically uses more tokens per character than English
	return Math.ceil(text.length / 3);
}

/**
 * Build optimized messages array
 */
function buildMessagesArray(message: Message, systemConfiguration: string, messageHistory: ReadonlyArray<Message> = []): Message[] {
	// Pre-allocate array size for better performance
	const messagesLength = messageHistory.length + 2;
	const messages = new Array<Message>(messagesLength);

	// System message first
	messages[0] = {
		...SYSTEM_MESSAGE_TEMPLATE,
		content: systemConfiguration,
	};

	// Add history messages
	for (let i = 0; i < messageHistory.length; i++) {
		messages[i + 1] = messageHistory[i];
	}

	// Current message last
	messages[messagesLength - 1] = message;

	return messages;
}

/**
 * Main chat helper function
 */
export async function chatHelper(
	message: Message,
	options: {
		model?: string;
		systemConfiguration?: string;
		messageHistory?: ReadonlyArray<Message>;
		maxTokens?: number;
		temperature?: number;
	} = {},
): Promise<ChatResult> {
	const startTime = Date.now();

	// Extract options with defaults
	const { model = 'gpt-4-turbo', systemConfiguration = SYSTEM_PROMPTS.GENERAL_ASSISTANT, messageHistory = [], maxTokens = 1000, temperature = 0.7 } = options;

	logger.debug('Starting chat completion', {
		model,
		messageRole: message.role,
		contentLength: message.content.length,
		historyLength: messageHistory.length,
	});

	// Validate input message
	const validation = validateMessage(message);
	if (!validation.valid) {
		throw new HTTPException(400, `Invalid message: ${validation.error}`);
	}

	try {
		// Build messages array efficiently
		const messages = buildMessagesArray(message, systemConfiguration, messageHistory);

		// Estimate total tokens for logging
		const estimatedTokens = messages.reduce((total, msg) => total + estimateTokenCount(msg.content), 0);

		logger.debug('Messages prepared', {
			messageCount: messages.length,
			estimatedTokens,
			maxTokens,
		});

		// Get client instance
		const clientInstance = getClient();

		// Make API call with retry logic
		const completion = await withRetry(async (): Promise<ChatCompletion> => {
			return (await clientInstance.chat.completions.create({
				model,
				messages,
				max_tokens: maxTokens,
				temperature,
			})) as ChatCompletion;
		});

		const responseTime = Date.now() - startTime;

		// Extract response data
		const choice = completion.choices[0];
		if (!choice?.message?.content) {
			throw new Error('No content returned from ChatGPT API');
		}

		// Build response message
		const responseMessage: Message = {
			...ASSISTANT_RESPONSE_TEMPLATE,
			content: choice.message.content,
			refusal: choice.message.refusal,
		};

		const result: ChatResult = {
			message: responseMessage,
			usage: completion.usage,
			response_time: responseTime,
			finish_reason: choice.finish_reason,
		};

		logger.debug('Chat completion successful', {
			responseLength: responseMessage.content.length,
			responseTime,
			usage: completion.usage,
			finishReason: choice.finish_reason,
		});

		return result;
	} catch (error) {
		const responseTime = Date.now() - startTime;
		const errorMessage = error instanceof Error ? error.message : String(error);

		logger.error('Chat completion failed', {
			error: errorMessage,
			responseTime,
			model,
			messageContent: message.content.substring(0, 100) + '...',
		});

		// Enhanced error handling for common ChatGPT errors
		let statusCode = 500;
		let enhancedError = errorMessage;

		if (errorMessage.includes('rate_limit_exceeded')) {
			statusCode = 429;
			enhancedError = 'Rate limit exceeded. Please wait before making more requests.';
		} else if (errorMessage.includes('quota_exceeded')) {
			statusCode = 429;
			enhancedError = 'API quota exceeded. Please check your OpenAI account usage.';
		} else if (errorMessage.includes('invalid_request_error')) {
			statusCode = 400;
			enhancedError = 'Invalid request. Please check your input parameters.';
		} else if (errorMessage.includes('context_length_exceeded')) {
			statusCode = 400;
			enhancedError = 'Context length exceeded. Please reduce the length of your message or history.';
		}

		throw new HTTPException(statusCode, enhancedError);
	}
}

/**
 * Specialized function for image description generation in Thai - FIXED
 */
export async function generateImageDescription(
	originalPrompt: string,
	imageUrl: string,
	tags: Array<{ name: string; description: string }> = [],
	options: {
		model?: string;
		maxTokens?: number;
	} = {},
): Promise<string> {
	const tagContext = tags.length > 0 ? `\n\nบริบทสไตล์จากแท็กที่เลือก:\n${tags.map((tag) => `- ${tag.name}: ${tag.description}`).join('\n')}` : '';

	const prompt = `วิเคราะห์ภาพที่สร้างขึ้นนี้และสร้างคำอธิบายที่น่าสนใจสำหรับแกลเลอรี่เชิงสร้างสรรค์

พรอมต์ของผู้ใช้เดิม: "${originalPrompt}"
${tagContext}

โปรดให้คำอธิบายที่รวมถึง:
1. องค์ประกอบทางภาพหลักและการจัดวาง
2. สี แสง และอารมณ์ทางศิลปะ
3. สไตล์และเทคนิคที่ใช้
4. วิธีการตอบสนองเจตนาเชิงสร้างสรรค์เดิม
5. สิ่งที่ทำให้ภาพนี้มีความโดดเด่นหรือเฉพาะตัว

ให้คำอธิบายที่น่าสนใจและกระชับ (3-4 ประโยค) เน้นสิ่งที่ทำให้ภาพนี้พิเศษ

**ตอบเป็นภาษาไทยเท่านั้น และให้คำอธิบายที่สมบูรณ์**`;

	const message: Message = {
		role: 'user',
		content: prompt,
	};

	try {
		const result = await chatHelper(message, {
			model: options.model || 'gpt-4-turbo',
			systemConfiguration: SYSTEM_PROMPTS.IMAGE_DESCRIPTION,
			maxTokens: options.maxTokens || 500, // Increased significantly for Thai language
			temperature: 0.7,
		});

		return result.message.content;
	} catch (error) {
		logger.error('Failed to generate image description', error);
		return `ภาพเชิงสร้างสรรค์ที่สร้างจาก: "${originalPrompt}"`;
	}
}

/**
 * Specialized function for output tag generation in Thai - FIXED
 */
export async function generateOutputTags(
	originalPrompt: string,
	description: string,
	existingTags: Array<{ name: string }> = [],
	options: {
		model?: string;
		maxTokens?: number;
	} = {},
): Promise<string> {
	const existingTagNames = existingTags.map((tag) => tag.name).join(', ');
	const existingTagsContext = existingTagNames ? `\n\nแท็กสไตล์ที่มีอยู่: ${existingTagNames}` : '';

	const prompt = `สร้างแท็ก 4-6 ตัวที่เกี่ยวข้องสำหรับภาพเชิงสร้างสรรค์นี้ตามพรอมต์และคำอธิบาย

พรอมต์เดิม: "${originalPrompt}"
คำอธิบายที่สร้าง: "${description}"
${existingTagsContext}

สร้างแท็กที่:
- เกี่ยวข้องกับเนื้อหาทางภาพและสไตล์
- มีประโยชน์สำหรับการค้นหาและจัดหมวดหมู่
- กระชับ (1-2 คำในแต่ละแท็ก)
- หลากหลาย (ครอบคลุมหัวข้อ สไตล์ อารมณ์ เทคนิค)
- แตกต่างจากแท็กที่มีอยู่หากเป็นไปได้

รูปแบบ: ส่งคืนเฉพาะแท็กที่คั่นด้วยจุลภาคเท่านั้น ไม่ต้องใส่อย่างอื่น
ตัวอย่าง: "นก, ป่าเขา, ธรรมชาติ, สีเขียว, สงบ, ศิลปะดิจิทัล"

**ตอบเป็นภาษาไทยเท่านั้น และส่งคืนเฉพาะแท็กที่คั่นด้วยจุลภาค**`;

	const message: Message = {
		role: 'user',
		content: prompt,
	};

	try {
		const result = await chatHelper(message, {
			model: options.model || 'gpt-4-turbo',
			systemConfiguration: SYSTEM_PROMPTS.TAG_GENERATION,
			maxTokens: options.maxTokens || 200, // Increased for Thai language
			temperature: 0.5,
		});

		// Clean up the response - FIXED regex to handle Thai characters properly
		const cleanedResponse = result.message.content
			.replace(/[^\u0E00-\u0E7Fa-zA-Z\s,]/g, '') // Allow Thai characters, English letters, spaces, and commas
			.replace(/\s+/g, ' ') // Replace multiple spaces with single space
			.replace(/,\s*,/g, ',') // Remove duplicate commas
			.replace(/^\s*,|,\s*$/g, '') // Remove leading/trailing commas
			.trim();

		// Validate that we have actual content
		if (!cleanedResponse || cleanedResponse.length < 3) {
			logger.info('Generated tags were empty or too short, using fallback');
			return 'สร้างสรรค์, ศิลปะ, ดิจิทัล, ปัญญาประดิษฐ์';
		}

		return cleanedResponse;
	} catch (error) {
		logger.error('Failed to generate output tags', error);
		return 'สร้างสรรค์, ศิลปะ, ดิจิทัล, ปัญญาประดิษฐ์';
	}
}

// Export for backward compatibility
export default chatHelper;
