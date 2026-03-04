import { CasCamsParsedData } from '@/types/cams-cas.type';
import { casCamsParser } from './cas-cams-parser.service';

class CasCamsPdfService {
    async parsePdf(pdfBuffer: Buffer, password: string): Promise<CasCamsParsedData> {
        const pages = await this.extractText(pdfBuffer, password);
        return casCamsParser.parse(pages);
    }

    private async extractText(pdfBuffer: Buffer, password: string): Promise<{ text: string; num: number }[]> {
        const { PDFParse } = require('pdf-parse');
        const parser = new PDFParse({ data: new Uint8Array(pdfBuffer), password });
        await parser.load();
        const result = await parser.getText();
        await parser.destroy();
        return result.pages;
    }
}

export const casCamsPdfService = new CasCamsPdfService();
