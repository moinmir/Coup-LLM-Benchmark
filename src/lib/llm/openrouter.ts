/**
 * OpenRouter API client for LLM inference
 */

import { env } from "~/env";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterResponse {
  id: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenRouterError {
  error?: {
    message: string;
    code?: string | number;
  };
}

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/**
 * Call OpenRouter API with retry logic for rate limiting
 */
export async function callOpenRouter(
  model: string,
  messages: ChatMessage[],
  maxTokens = 1024,
  temperature = 0.7
): Promise<string> {
  const apiKey = env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY environment variable is not set. " +
      "Get your API key from https://openrouter.ai/keys and add it to your .env file."
    );
  }

  const maxRetries = 5;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://coup-llm-benchmark.local",
          "X-Title": "Coup LLM Benchmark",
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          temperature,
        }),
      });

      if (response.status === 429) {
        // Rate limited - wait and retry
        const waitTime = Math.min(2 ** attempt * 1000, 60000);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      if (!response.ok) {
        const errorBody = (await response.json()) as OpenRouterError;
        throw new Error(
          errorBody.error?.message ?? `HTTP error ${response.status}`
        );
      }

      const data = (await response.json()) as OpenRouterResponse;
      return data.choices[0]?.message.content ?? "";
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if it's a rate limit error
      const errorMsg = lastError.message.toLowerCase();
      if (
        errorMsg.includes("429") ||
        errorMsg.includes("rate limit") ||
        errorMsg.includes("quota")
      ) {
        const waitTime = Math.min(2 ** attempt * 1000, 60000);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }
      
      throw lastError;
    }
  }

  throw lastError ?? new Error("Max retries exceeded");
}

