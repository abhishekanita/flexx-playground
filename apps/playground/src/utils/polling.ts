/**
 * General polling utility for async operations with retry logic
 */

export interface PollingOptions<K> {
    /** Maximum time to wait in milliseconds (default: 60000 = 1 minute) */
    timeoutMs?: number;
    /** Interval between polls in milliseconds (default: 2000 = 2 seconds) */
    intervalMs?: number;
    /** Maximum number of attempts (default: unlimited within timeout) */
    maxAttempts?: number;
    /** Function to determine if result is ready (default: truthy check) */
    isReady?: (result: K) => boolean;
    /** Function to determine if error should trigger retry (default: retry all errors) */
    shouldRetry?: (error: any, attempt: number) => boolean;
    /** Description for logging purposes */
    description?: string;
    /** Abort signal to cancel polling */
    signal?: AbortSignal;
}

export interface PollingResult<T> {
    success: boolean;
    result?: T;
    error?: Error;
    attempts: number;
    duration: number;
}

/**
 * Poll a function until it succeeds or times out
 * @param pollFn Function to poll (should throw on failure, return result on success)
 * @param options Polling configuration
 * @returns Promise with polling result
 */
export async function pollUntilReady<T>(pollFn: () => Promise<T>, options: PollingOptions<T> = {}): Promise<PollingResult<T>> {
    const {
        timeoutMs = 60000,
        intervalMs = 2000,
        maxAttempts = Infinity,
        isReady = result => !!result,
        shouldRetry = () => true,
        description = 'polling operation',
        signal,
    } = options;

    const startTime = Date.now();
    let attempts = 0;
    let lastError: Error | null = null;

    while (Date.now() - startTime < timeoutMs && attempts < maxAttempts) {
        attempts++;

        try {
            // console.log(`[Polling] Attempt ${attempts} for ${description}`);
            const result = await pollFn();

            if (isReady(result)) {
                const duration = Date.now() - startTime;
                console.log(`[Polling] Success after ${attempts} attempts (${duration}ms) for ${description}`);
                return {
                    success: true,
                    result,
                    attempts,
                    duration,
                };
            } else {
                console.log(`[Polling] Result not ready yet for ${description}:`);
            }
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            // console.log(`[Polling] Attempt ${attempts} failed for ${description}:`, lastError.message);

            if (!shouldRetry(lastError, attempts)) {
                console.log(`[Polling] Stopping retry for ${description} due to shouldRetry=false`);
                break;
            }
        }

        // Wait before next attempt (unless this was the last possible attempt)
        if (Date.now() - startTime < timeoutMs - intervalMs && attempts < maxAttempts) {
            await new Promise((resolve, reject) => {
                const timer = setTimeout(resolve, intervalMs);
            });
        }
    }

    const duration = Date.now() - startTime;
    const timeoutReached = Date.now() - startTime >= timeoutMs;
    const maxAttemptsReached = attempts >= maxAttempts;

    let errorMessage = `Polling failed for ${description} after ${attempts} attempts (${duration}ms)`;
    if (timeoutReached) errorMessage += ' - timeout reached';
    if (maxAttemptsReached) errorMessage += ' - max attempts reached';
    if (lastError) errorMessage += ` - last error: ${lastError.message}`;

    console.log(`[Polling] ${errorMessage}`);

    return {
        success: false,
        error: lastError || new Error(errorMessage),
        attempts,
        duration,
    };
}

/**
 * Poll until a condition is met
 * @param conditionFn Function that returns true when condition is met
 * @param options Polling configuration
 * @returns Promise with polling result
 */
export async function pollUntilCondition(
    conditionFn: () => Promise<boolean>,
    options: PollingOptions<any> = {}
): Promise<PollingResult<boolean>> {
    return pollUntilReady(
        async () => {
            const result = await conditionFn();
            if (!result) {
                throw new Error('Condition not met');
            }
            return result;
        },
        {
            ...options,
            isReady: result => result === true,
        }
    );
}

/**
 * Poll a URL until it's accessible
 * @param url URL to poll
 * @param options Polling configuration
 * @returns Promise with polling result containing response
 */
export async function pollUrl(
    url: string,
    options: PollingOptions<any> & {
        expectedStatus?: number;
        method?: string;
        headers?: Record<string, string>;
    } = {}
): Promise<PollingResult<Response>> {
    const { expectedStatus = 200, method = 'GET', headers = {}, ...pollOptions } = options;

    return pollUntilReady(
        async () => {
            const response = await fetch(url, {
                method,
                headers,
            });

            if (response.status !== expectedStatus) {
                throw new Error(`Expected status ${expectedStatus}, got ${response.status}`);
            }

            return response;
        },
        {
            ...pollOptions,
            description: pollOptions.description || `URL accessibility: ${url}`,
            shouldRetry: (error, attempt) => {
                // Retry on network errors, 404s (file not ready), 5xx errors
                if (error.message.includes('fetch')) return true;
                if (error.message.includes('404') || error.message.includes('Not Found')) return true;
                if (error.message.includes('5')) return true; // 5xx errors

                // Don't retry on auth errors (401, 403)
                if (error.message.includes('401') || error.message.includes('403')) return false;

                // Default: retry unless explicitly configured
                return pollOptions.shouldRetry ? pollOptions.shouldRetry(error, attempt) : true;
            },
        }
    );
}

/**
 * Helper for exponential backoff intervals
 * @param baseInterval Base interval in ms
 * @param attempt Current attempt number (1-based)
 * @param maxInterval Maximum interval in ms
 * @returns Calculated interval with exponential backoff
 */
export function exponentialBackoff(baseInterval: number, attempt: number, maxInterval = 30000): number {
    const interval = baseInterval * Math.pow(2, attempt - 1);
    return Math.min(interval, maxInterval);
}

/**
 * Create polling options with exponential backoff
 * @param options Base polling options
 * @returns Options with exponential backoff interval calculation
 */
export function withExponentialBackoff(options: PollingOptions<any> = {}): PollingOptions<any> & {
    getIntervalMs: (attempt: number) => number;
} {
    const baseInterval = options.intervalMs || 2000;
    const maxInterval = Math.min(options.timeoutMs || 60000, 30000);

    return {
        ...options,
        getIntervalMs: (attempt: number) => exponentialBackoff(baseInterval, attempt, maxInterval),
    };
}
