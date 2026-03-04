/**
 * Utility for generating short, readable IDs for artifacts
 */

const CHARACTERS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const VOWELS = 'aeiou';
const CONSONANTS = 'bcdfghjklmnpqrstvwxyz';

/**
 * Generate a short random string ID
 * @param length - Length of the ID (default: 6)
 * @returns Short random string
 */
export function generateShortId(length = 6): string {
    let result = '';
    for (let i = 0; i < length; i++) {
        result += CHARACTERS.charAt(Math.floor(Math.random() * CHARACTERS.length));
    }
    return result;
}

/**
 * Generate a pronounceable short ID using alternating consonants and vowels
 * @param length - Length of the ID (default: 6, must be even)
 * @returns Pronounceable short string
 */
export function generateReadableId(length = 6): string {
    if (length % 2 !== 0) {
        length += 1; // Make it even for alternating pattern
    }

    let result = '';
    for (let i = 0; i < length; i++) {
        if (i % 2 === 0) {
            // Use consonant
            result += CONSONANTS.charAt(Math.floor(Math.random() * CONSONANTS.length));
        } else {
            // Use vowel
            result += VOWELS.charAt(Math.floor(Math.random() * VOWELS.length));
        }
    }
    return result;
}

/**
 * Generate a short ID with prefix for better categorization
 * @param prefix - Prefix to add (e.g., 'doc', 'img', 'data')
 * @param length - Length of random part (default: 4)
 * @returns Prefixed short ID like 'doc-abc4'
 */
export function generatePrefixedId(prefix: string, length = 4): string {
    return `${prefix}-${generateShortId(length)}`;
}

/**
 * Generate artifact ID based on category
 * @param category - Artifact category
 * @returns Category-appropriate short ID
 */
export function generateArtifactId(category: string): string {
    const prefixMap: Record<string, string> = {
        document: 'doc',
        pdf: 'pdf',
        spreadsheet: 'sheet',
        presentation: 'slide',
        image: 'img',
        data: 'data',
        code: 'code',
        collaborative: 'collab',
    };

    const prefix = prefixMap[category.toLowerCase()] || 'art';
    return generatePrefixedId(prefix, 4);
}
