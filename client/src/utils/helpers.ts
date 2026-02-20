/**
 * Utility Helper Functions
 *
 * Common utilities for transaction handling, delays, and formatting
 */

/**
 * Delay execution for specified milliseconds
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a random salt for VRF requests
 * @param gameId - The game ID
 * @param seed - Additional seed value
 * @returns BigInt salt value
 */
export function generateSalt(gameId: number, seed: number): bigint {
  // Combine gameId and seed with current timestamp for randomness
  const timestamp = Date.now();
  const combined = BigInt(gameId) * BigInt(1000000) + BigInt(seed) * BigInt(1000) + BigInt(timestamp);
  return combined;
}

/**
 * Generate battle-specific salt for VRF
 * @param gameId - The game ID
 * @param actionCount - Current action count
 * @param battleIndex - Battle index
 * @returns BigInt salt value
 */
export function generateBattleSalt(gameId: number, actionCount: number, battleIndex: number): bigint {
  return BigInt(gameId) * BigInt(100000) + BigInt(actionCount) * BigInt(100) + BigInt(battleIndex);
}

/**
 * Format a transaction hash for display
 * @param hash - The transaction hash
 * @returns Formatted hash string
 */
export function formatTxHash(hash: string): string {
  if (!hash) return "";
  if (hash.length <= 10) return hash;
  return `${hash.substring(0, 6)}...${hash.substring(hash.length - 4)}`;
}

/**
 * Shorten an address for display
 * @param address - The full address
 * @returns Shortened address string
 */
export function shortAddress(address: string): string {
  if (!address) return "";
  if (address.length <= 10) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

/**
 * Check if a value is defined and not null
 * @param value - Value to check
 * @returns True if value is defined
 */
export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

/**
 * Retry a function with exponential backoff
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries
 * @param delayMs - Initial delay in milliseconds
 * @returns Promise with function result
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 500
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        // Exponential backoff: 500ms, 1000ms, 2000ms, etc.
        const backoffDelay = delayMs * Math.pow(2, i);
        console.warn(`Attempt ${i + 1} failed, retrying in ${backoffDelay}ms...`);
        await delay(backoffDelay);
      }
    }
  }

  throw lastError || new Error("Retry failed");
}

/**
 * Parse error message from transaction error
 * @param error - Error object
 * @returns Human-readable error message
 */
export function parseTransactionError(error: any): string {
  if (typeof error === "string") return error;

  if (error?.message) {
    // Extract meaningful message from Starknet errors
    if (error.message.includes("REVERTED")) {
      return "Transaction reverted";
    }
    if (error.message.includes("REJECTED")) {
      return "Transaction rejected";
    }
    if (error.message.includes("timeout")) {
      return "Transaction timeout";
    }
    return error.message;
  }

  return "Unknown transaction error";
}

/**
 * Log with timestamp for debugging
 * @param message - Message to log
 * @param data - Optional data to log
 */
export function debugLog(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[${timestamp}] ${message}`, data);
  } else {
    console.log(`[${timestamp}] ${message}`);
  }
}

/**
 * Convert a felt252 hex string to a signed i32 number.
 * In Cairo, negative i32 values are serialized as STARK_PRIME - |value|.
 * parseInt loses precision on these large hex strings, so we use BigInt.
 */
const STARK_PRIME = BigInt("0x800000000000011000000000000000000000000000000000000000000000001");
const HALF_PRIME = STARK_PRIME / 2n;

export function feltHexToI32(hex: string): number {
  const value = BigInt(hex);
  if (value > HALF_PRIME) {
    return Number(value - STARK_PRIME);
  }
  return Number(value);
}
