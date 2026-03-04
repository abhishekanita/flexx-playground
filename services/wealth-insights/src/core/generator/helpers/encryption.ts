import * as crypto from 'crypto';
import logger, { ServiceLogger } from '@/utils/logger';

export class CAMSEncryptionHelper {
    encryptKey: Buffer;
    decryptKey: Buffer;

    static readonly IV = Buffer.from('globalaesvectors', 'utf-8');
    static readonly ENCRYPT_KEY_SEED = 'TkVJTEhobWFj';
    static readonly DECRYPT_KEY_SEED = 'UkRYTElobWFj';

    constructor() {
        this.encryptKey = this.deriveKey(CAMSEncryptionHelper.ENCRYPT_KEY_SEED);
        this.decryptKey = this.deriveKey(CAMSEncryptionHelper.DECRYPT_KEY_SEED);
    }

    /** Parse and decrypt the raw response from CAMS */
    decryptResponse<T>(rawResponse: string): T {
        let ciphertext = rawResponse;
        try {
            const parsed = JSON.parse(rawResponse);
            if (typeof parsed === 'string') {
                ciphertext = parsed;
            } else if (typeof parsed?.data === 'string') {
                ciphertext = parsed.data;
            } else {
                return parsed as T;
            }
        } catch {
            // Not JSON — raw encrypted string
        }

        const decrypted = this.decrypt(ciphertext);
        return JSON.parse(decrypted);
    }

    decryptRequest(ciphertext: string): string {
        const b64 = ciphertext.replace(/-/g, '+').replace(/_/g, '/');
        const data = Buffer.from(b64, 'base64');
        const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptKey, CAMSEncryptionHelper.IV);
        let decrypted = decipher.update(data);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString('utf-8');
    }

    // ─── Crypto ─────────────────────────────────────────────────────────────

    deriveKey(seed: string): Buffer {
        const hash = crypto.createHash('sha256').update(seed).digest('hex');
        return Buffer.from(hash.substring(0, 32), 'utf-8');
    }

    encrypt(plaintext: string): string {
        const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptKey, CAMSEncryptionHelper.IV);
        let encrypted = cipher.update(plaintext, 'utf-8');
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return encrypted.toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
    }

    decrypt(ciphertext: string): string {
        const b64 = ciphertext.replace(/-/g, '+').replace(/_/g, '/');
        const data = Buffer.from(b64, 'base64');
        const decipher = crypto.createDecipheriv('aes-256-cbc', this.decryptKey, CAMSEncryptionHelper.IV);
        let decrypted = decipher.update(data);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString('utf-8');
    }
}
