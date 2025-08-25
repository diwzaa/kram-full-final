// Optimized Chat Helper for Kram Pattern System
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

// System prompts for different Kram Pattern use cases
export const SYSTEM_PROMPTS = {
	IMAGE_DESCRIPTION: `You are an expert art critic and image analyst. Create engaging, detailed descriptions of generated images that capture their visual elements, artistic style, mood, and creative impact. Focus on what makes each image unique and compelling for a creative gallery audience.`,

	TAG_GENERATION: `You are a creative content categorization expert. Generate relevant, searchable tags for images based on their content, style, and artistic elements. Provide concise, useful tags that help users discover and organize creative content.`,

	PROMPT_ENHANCEMENT: `You are a creative prompt engineer specializing in image generation. Enhance user prompts to be more specific, visually descriptive, and optimized for AI image generation while maintaining the user's original intent.`,

	GENERAL_ASSISTANT: `You are a helpful assistant specialized in creative arts and image generation. Provide clear, informative responses while maintaining a creative and inspiring tone.`,
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
 * Estimate token count (rough approximation)
 */
function estimateTokenCount(text: string): number {
	// Rough estimation: 1 token ≈ 4 characters for English text
	return Math.ceil(text.length / 4);
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
 * Specialized function for image description generation
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
	const tagContext = tags.length > 0 ? `\n\nStyle context from selected tags:\n${tags.map((tag) => `- ${tag.name}: ${tag.description}`).join('\n')}` : '';

	const prompt = `Analyze this generated image and create a compelling description for a creative gallery.

Original user prompt: "${originalPrompt}"
${tagContext}

Please provide a description that includes:
1. Main visual elements and composition
2. Colors, lighting, and artistic mood  
3. Style and technique used
4. How it fulfills the original creative intent
5. What makes it visually striking or unique
6. Answer in Thai

Keep it engaging and concise (2-3 sentences). Focus on what makes this image special.

Note: I cannot actually see the image at ${imageUrl}, so base your description on the original prompt and context provided.`;

	const message: Message = {
		role: 'user',
		content: prompt,
	};

	try {
		const result = await chatHelper(message, {
			model: options.model || 'gpt-4-turbo',
			systemConfiguration: SYSTEM_PROMPTS.IMAGE_DESCRIPTION,
			maxTokens: options.maxTokens || 300,
			temperature: 0.7,
		});

		return result.message.content;
	} catch (error) {
		logger.error('Failed to generate image description', error);
		return `A creative image generated from: "${originalPrompt}"`;
	}
}

/**
 * Specialized function for output tag generation
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
	const existingTagsContext = existingTagNames ? `\n\nExisting style tags used: ${existingTagNames}` : '';

	const prompt = `Generate 4-6 relevant tags for this creative image based on the prompt and description.

Original prompt: "${originalPrompt}"
Generated description: "${description}"
${existingTagsContext}

Create tags that are:
- Relevant to visual content and style
- Useful for search and categorization  
- Concise (1-2 words each)
- Diverse (covering subject, style, mood, technique)
- Different from existing tags when possible

Format: Return only the tags separated by commas, nothing else.
Example: "abstract, vibrant, geometric, digital, atmospheric"`;

	const message: Message = {
		role: 'user',
		content: prompt,
	};

	try {
		const result = await chatHelper(message, {
			model: options.model || 'gpt-4-turbo',
			systemConfiguration: SYSTEM_PROMPTS.TAG_GENERATION,
			maxTokens: options.maxTokens || 100,
			temperature: 0.5,
		});

		// Clean up the response to ensure it's just comma-separated tags
		return result.message.content
			.replace(/[^\w\s,]/g, '')
			.replace(/\s+/g, ' ')
			.trim();
	} catch (error) {
		logger.error('Failed to generate output tags', error);
		return 'generated, creative, ai-art, digital';
	}
}

// Export for backward compatibility
export default chatHelper;
