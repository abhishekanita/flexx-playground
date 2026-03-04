import { CAMSEncryptionHelper } from '@/core/generator/helpers/encryption';
import * as fs from 'fs';

export const decodeCurl = () => {
    const file = fs.readFileSync('./curls/request.json', 'utf-8');
    const data = JSON.parse(file);
    console.log(data);

    const e = new CAMSEncryptionHelper();

    console.log('--- Decrypted Request ---');
    try {
        console.log(e.decryptRequest(data.input));
    } catch (err: any) {
        console.log('[DECRYPT FAILED]', err.message);
    }

    console.log('--- Decrypted Response ---');
    try {
        console.log(e.decrypt(data.output));
    } catch (err: any) {
        console.log('[DECRYPT FAILED]', err.message);
    }
};
