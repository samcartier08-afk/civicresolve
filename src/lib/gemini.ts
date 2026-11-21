import { GoogleGenAI } from "@google/genai";

export const GEMINI_MODELS = {
  fast: process.env.GEMINI_FAST_MODEL || "gemini-3.8-flash",
  reasoning: process.env.GEMINI_REASONING_MODEL || "gemini-4-argon",
} as const;

export function isApiKeyConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key && key !== "your_gemini_api_key_here");
}

let cachedClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!isApiKeyConfigured()) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Add it to .env.local (local) or your host's Environment Variables (production)."
    );
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return cachedClient;
}

export function resolveModel(useDeepReasoning?: boolean): string {
  return useDeepReasoning ? GEMINI_MODELS.reasoning : GEMINI_MODELS.fast;
}
