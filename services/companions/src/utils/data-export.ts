import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const DATA_DIR = path.join(process.cwd(), 'data');

export function createExportSession(prefix: string = ''): string {
    const sessionId = randomUUID().substring(0, 8);
    const folderName = prefix ? `${prefix}-${sessionId}` : sessionId;
    const sessionDir = path.join(DATA_DIR, folderName);
    fs.mkdirSync(sessionDir, { recursive: true });
    return sessionDir;
}

export function saveJSON(sessionDir: string, filename: string, data: any): string {
    const filePath = path.join(sessionDir, filename.endsWith('.json') ? filename : `${filename}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return filePath;
}
