// OpenAI Client Management - Global singleton pattern
// This handles the OpenAI client initialization and management

interface OpenAIClient {
	images: {
		generate: (params: any) => Promise<any>;
	};
	chat: {
		completions: {
			create: (params: any) => Promise<any>;
		};
	};
}

// Global client instance - set this before using helpers
let client: OpenAIClient | null = null;
let isInitialized = false;

/**
 * Set the OpenAI client instance
 */
export function setClient(clientInstance: OpenAIClient): void {
	client = clientInstance;
	isInitialized = true;
}

/**
 * Get the current OpenAI client instance
 */
export function getClient(): OpenAIClient {
	if (!client || !isInitialized) {
		throw new Error('OpenAI client not initialized. Call setClient() first.');
	}
	return client;
}

/**
 * Check if client is initialized
 */
export function isClientInitialized(): boolean {
	return isInitialized && client !== null;
}

/**
 * Reset client (mainly for testing)
 */
export function resetClient(): void {
	client = null;
	isInitialized = false;
}

/**
 * Initialize client with API key (alternative to setClient)
 */
export async function initializeClient(apiKey?: string): Promise<void> {
	if (!apiKey && !process.env.OPENAI_API_KEY) {
		throw new Error('OpenAI API key not found. Provide apiKey or set OPENAI_API_KEY environment variable.');
	}

	try {
		// Dynamic import to avoid bundling OpenAI SDK if not needed
		const { OpenAI } = await import('openai');

		const openai = new OpenAI({
			apiKey: apiKey || process.env.OPENAI_API_KEY,
		});

		setClient(openai as any);
	} catch (error) {
		throw new Error(`Failed to initialize OpenAI client: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

// Optimized logger with lazy evaluation and conditional compilation
export const logger = {
	debug:
		process.env.NODE_ENV !== 'production'
			? (message: string, data?: any) => {
					console.debug(`[OpenAI] ${message}`, data ? JSON.stringify(data, null, 2) : '');
			  }
			: () => {}, // No-op in production
	error: (message: string, error?: any) => {
		console.error(`[OpenAI Error] ${message}`, error);
	},
	info: (message: string, data?: any) => {
		console.log(`[OpenAI] ${message}`, data || '');
	},
};

// Rate limiting and retry logic
interface RateLimitConfig {
	maxRetries: number;
	baseDelay: number;
	maxDelay: number;
}

const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
	maxRetries: 3,
	baseDelay: 1000, // 1 second
	maxDelay: 8000, // 8 seconds
};

/**
 * Exponential backoff retry wrapper
 */
export async function withRetry<T>(operation: () => Promise<T>, config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG): Promise<T> {
	let lastError: Error;

	for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
		try {
			return await operation();
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			// Don't retry on non-retryable errors
			if (lastError.message.includes('content_policy_violation') || lastError.message.includes('invalid_request')) {
				throw lastError;
			}

			// Don't retry on final attempt
			if (attempt === config.maxRetries) {
				break;
			}

			// Calculate delay with exponential backoff
			const delay = Math.min(config.baseDelay * Math.pow(2, attempt), config.maxDelay);

			logger.debug(`Retry attempt ${attempt + 1}/${config.maxRetries} after ${delay}ms`, {
				error: lastError.message,
			});

			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}

	throw lastError!;
}
