// ─────────────────────────────────────────────────────────────────────────────
// AI Cost Calculator — pricing per 1M tokens (USD)
// ─────────────────────────────────────────────────────────────────────────────

interface ModelPricing {
    input: number;
    cachedInput: number;
    output: number;
}

const PRICING: Record<string, ModelPricing> = {
    'gpt-5-mini': { input: 0.25, cachedInput: 0.025, output: 2.0 },
    'gpt-4.1': { input: 3.0, cachedInput: 0.75, output: 12.0 },
    'gpt-4.1-mini': { input: 0.8, cachedInput: 0.2, output: 3.2 },
    'gpt-4.1-nano': { input: 0.2, cachedInput: 0.05, output: 0.8 },
    'o4-mini': { input: 4.0, cachedInput: 1.0, output: 16.0 },
};

export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
    cacheWriteTokens: number;
}

export interface CostBreakdown {
    inputCost: number;
    cachedInputCost: number;
    cacheWriteCost: number;
    outputCost: number;
    totalCost: number;
}

/**
 * Resolve a full model ID (e.g. "gpt-5-mini-2025-08-07") to a pricing key.
 */
function resolveModel(modelId: string): string {
    for (const key of Object.keys(PRICING)) {
        if (modelId.startsWith(key)) return key;
    }
    return modelId;
}

/**
 * Calculate cost in USD for a given model and token usage.
 * Non-cached input = inputTokens - cachedInputTokens.
 * Cache writes are charged at the regular input rate.
 */
export function calculateCost(modelId: string, usage: TokenUsage): CostBreakdown {
    const key = resolveModel(modelId);
    const pricing = PRICING[key];
    if (!pricing) {
        throw new Error(`Unknown model pricing: ${modelId} (resolved: ${key})`);
    }

    const nonCachedInput = usage.inputTokens - usage.cachedInputTokens;
    const inputCost = (nonCachedInput / 1_000_000) * pricing.input;
    const cachedInputCost = (usage.cachedInputTokens / 1_000_000) * pricing.cachedInput;
    const cacheWriteCost = (usage.cacheWriteTokens / 1_000_000) * pricing.input;
    const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;

    return {
        inputCost,
        cachedInputCost,
        cacheWriteCost,
        outputCost,
        totalCost: inputCost + cachedInputCost + cacheWriteCost + outputCost,
    };
}

/**
 * Format a USD cost for logging.
 */
export function formatCost(usd: number): string {
    if (usd < 0.01) return `$${usd.toFixed(6)}`;
    if (usd < 1) return `$${usd.toFixed(4)}`;
    return `$${usd.toFixed(2)}`;
}
