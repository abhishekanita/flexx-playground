// utils/simpleEncodingHelpers.ts - Essential helpers only

/**
 * 🔧 Simple encoding/decoding utilities for React
 * Copy these functions into your project for instant use!
 */

// =================== CORE FUNCTIONS ===================

/**
 * Convert any object to base64 string
 */
export const toBase64 = (obj: any): string => {
    return btoa(JSON.stringify(obj));
};

/**
 * Convert base64 string back to object
 */
export const fromBase64 = <T = any>(base64: string): T => {
    return JSON.parse(atob(base64));
};

/**
 * Convert any object to byte array
 */
export const toByteArray = (obj: any): number[] => {
    const jsonString = JSON.stringify(obj);
    return Array.from(new TextEncoder().encode(jsonString));
};

/**
 * Convert byte array back to object
 */
export const fromByteArray = <T = any>(bytes: number[]): T => {
    const jsonString = new TextDecoder().decode(new Uint8Array(bytes));
    return JSON.parse(jsonString);
};

// =================== SAFE VERSIONS (RECOMMENDED) ===================

/**
 * Safely decode base64 - returns null if failed
 */
export const safeFromBase64 = <T = any>(base64: string): T | null => {
    try {
        return fromBase64<T>(base64);
    } catch {
        return null;
    }
};

/**
 * Safely decode byte array - returns null if failed
 */
export const safeFromByteArray = <T = any>(bytes: number[]): T | null => {
    try {
        return fromByteArray<T>(bytes);
    } catch {
        return null;
    }
};

/**
 * Smart decoder - handles both base64 strings and byte arrays
 */
export const decode = <T = any>(input: string | number[]): T | null => {
    if (typeof input === 'string') {
        return safeFromBase64<T>(input);
    } else if (Array.isArray(input)) {
        return safeFromByteArray<T>(input);
    }
    return null;
};

// =================== REACT PATTERNS ===================

/**
 * Simple React hook for encoding/decoding
 */
import { useState } from 'react';

export const useDecoder = <T = any>() => {
    const [data, setData] = useState<T | null>(null);
    const [error, setError] = useState<string | null>(null);

    const decodeData = (input: string | number[]) => {
        const result = decode<T>(input);
        if (result) {
            setData(result);
            setError(null);
        } else {
            setError('Failed to decode');
        }
        return result;
    };

    return { data, error, decodeData, setData };
};

// =================== READY-TO-USE EXAMPLES ===================

// Example: Your specific response data type
export interface ResponseData {
    text: string;
    tone: string;
    confidence: number;
    reason: string;
}

// Example: Decode your byte array
const yourByteArray = [
    123, 34, 116, 101, 120, 116, 34, 58, 34, 89, 111, 32, 116, 104, 105, 115, 32, 105, 115, 32, 115, 112, 111, 116, 32, 111, 110, 33, 32,
    66, 101, 101, 110, 32, 116, 104, 105, 110, 107, 105, 110, 103, 32, 116, 104, 101, 32, 115, 97, 109, 101, 32, 116, 104, 105, 110, 103,
    32, 108, 97, 116, 101, 108, 121, 46, 32, 71, 114, 101, 97, 116, 32, 109, 105, 110, 100, 115, 32, 116, 104, 105, 110, 107, 32, 97, 108,
    105, 107, 101, 34, 44, 34, 116, 111, 110, 101, 34, 58, 34, 102, 114, 105, 101, 110, 100, 108, 121, 34, 44, 34, 99, 111, 110, 102, 105,
    100, 101, 110, 99, 101, 34, 58, 48, 46, 57, 49, 44, 34, 114, 101, 97, 115, 111, 110, 34, 58, 34, 77, 101, 100, 105, 117, 109, 32, 101,
    110, 103, 97, 103, 101, 109, 101, 110, 116, 32, 116, 119, 101, 101, 116, 32, 98, 101, 110, 101, 102, 105, 116, 115, 32, 102, 114, 111,
    109, 32, 97, 32, 98, 97, 108, 97, 110, 99, 101, 100, 32, 114, 101, 115, 112, 111, 110, 115, 101, 34, 125,
];

export const decodedResponse = decode<ResponseData>(yourByteArray);
// Result: { text: "Yo this is spot on! ...", tone: "friendly", ... }

/*
=================== QUICK USAGE ===================

// In your React component:
import { decode, useDecoder, ResponseData } from './utils/simpleEncodingHelpers';

const MyComponent = () => {
  const { data, error, decodeData } = useDecoder<ResponseData>();
  
  const handleDecode = () => {
    const input = "[123, 34, 116, ...]"; // your encoded data
    const byteArray = JSON.parse(input);
    decodeData(byteArray);
  };
  
  return (
    <div>
      <button onClick={handleDecode}>Decode</button>
      {error && <p>Error: {error}</p>}
      {data && (
        <div>
          <p>Text: {data.text}</p>
          <p>Tone: {data.tone}</p>
          <p>Confidence: {data.confidence}</p>
        </div>
      )}
    </div>
  );
};
*/
