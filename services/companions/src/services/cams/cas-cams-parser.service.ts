import { CasCamsParsedData, CasCamsInvestor, CasCamsHolding, CasCamsLoadInfo } from '@/types/cams-cas.type';

class CasCamsParserService {
    parse(pages: { text: string; num: number }[]): CasCamsParsedData {
        if (!pages.length) throw new Error('No pages found in PDF');

        // Sort pages by number and concatenate all text
        const sorted = [...pages].sort((a, b) => a.num - b.num);
        const fullText = sorted.map(p => p.text).join('\n');

        // Strip repeated page headers (appear on every page after page 1)
        // Pattern: "CAMSCASWS-... Version:...\nConsolidated Account Summary\nAs on ...\nPage N of M"
        const stripped = fullText.replace(
            /(?<=\n)CAMSCASWS-\S+ Version:.+\nConsolidated Account Summary\nAs on \d{1,2}-\w{3}-\d{4}\nPage \d+ of \d+/g,
            ''
        );

        const { documentId, version } = this.parseDocumentHeader(stripped);
        const statementDate = this.parseStatementDate(stripped);
        const investor = this.parseInvestorInfo(stripped);
        const { holdings, totalMarketValue, totalCostValue } = this.parseHoldings(stripped);
        const loadsAndFees = this.parseLoadsAndFees(stripped);

        return {
            documentId,
            version,
            statementDate,
            statementType: 'summary',
            investor,
            holdings,
            totalMarketValue,
            totalCostValue,
            loadsAndFees,
        };
    }

    private parseDocumentHeader(text: string): { documentId: string; version: string } {
        const match = text.match(/^(CAMSCASWS-\S+)\s+Version:(.+)$/m);
        return {
            documentId: match?.[1] || '',
            version: match?.[2]?.trim() || '',
        };
    }

    private parseStatementDate(text: string): string {
        const match = text.match(/As on (\d{1,2}-\w{3}-\d{4})/);
        return match ? this.parseCamsDate(match[1]) : '';
    }

    private parseInvestorInfo(text: string): CasCamsInvestor {
        const email = text.match(/Email Id:\s*(\S+)/)?.[1] || '';
        const mobile = text.match(/Mobile:\s*(\S+)/)?.[1] || '';

        const lines = text.split('\n');
        const emailLineIdx = lines.findIndex(l => l.startsWith('Email Id:'));
        const name = emailLineIdx >= 0 ? lines[emailLineIdx + 1]?.trim() || '' : '';

        let guardianName: string | undefined;
        const guardianMatch = text.match(/([SDWC]\/O):\s*([^,]+)/);
        if (guardianMatch) {
            guardianName = `${guardianMatch[1]}: ${guardianMatch[2].trim()}`;
        }

        const nameLineIdx = emailLineIdx + 1;
        const mobileLineIdx = lines.findIndex(l => l.startsWith('Mobile:'));
        let address = '';
        if (nameLineIdx >= 0 && mobileLineIdx > nameLineIdx) {
            const addressLines = lines.slice(nameLineIdx + 1, mobileLineIdx);
            address = addressLines
                .filter(l => !l.startsWith('The Consolidated'))
                .map(l => l.trim())
                .filter(Boolean)
                .join(', ');
        }

        return { name, email, address, mobile, guardianName };
    }

    private parseHoldings(text: string): { holdings: CasCamsHolding[]; totalMarketValue: number; totalCostValue: number } {
        const headerMatch = text.match(/ISIN\s+Cost Value\n\(INR\)\n/);
        const totalMatch = text.match(/^Total\s+([\d,]+\.\d+)\t([\d,]+\.\d+)/m);

        if (!headerMatch || !totalMatch) {
            throw new Error('Could not find holdings table boundaries');
        }

        const tableStart = headerMatch.index! + headerMatch[0].length;
        const tableEnd = totalMatch.index!;
        const tableText = text.substring(tableStart, tableEnd);

        const holdings: CasCamsHolding[] = [];
        const lines = tableText.split('\n').filter(l => l.trim());

        const line1Regex = /^([\d/]+)\s+([\d,]+\.\d+)\t(\w+)\s+-\s+(.+)$/;
        const dataLineRegex = /^([\d,]+\.\d+)\s+(\d{1,2}-\w{3}-\d{4})\s+([\d.]+)\s+(CAMS|KFINTECH)\t(INF\w+)\s+([\d,]+\.\d+)$/;

        let i = 0;
        while (i < lines.length) {
            const line1Match = lines[i].match(line1Regex);
            if (!line1Match) {
                i++;
                continue;
            }

            const folioNumber = line1Match[1];
            const marketValue = this.parseIndianNumber(line1Match[2]);
            const schemeCode = line1Match[3];
            let schemeName = line1Match[4];
            i++;

            while (i < lines.length && !dataLineRegex.test(lines[i])) {
                schemeName += ' ' + lines[i].trim();
                i++;
            }

            if (i >= lines.length) break;

            const dataMatch = lines[i].match(dataLineRegex);
            if (!dataMatch) { i++; continue; }

            holdings.push({
                folioNumber,
                schemeCode,
                schemeName: schemeName.trim(),
                unitBalance: this.parseIndianNumber(dataMatch[1]),
                navDate: this.parseCamsDate(dataMatch[2]),
                nav: parseFloat(dataMatch[3]),
                marketValue,
                costValue: this.parseIndianNumber(dataMatch[6]),
                registrar: dataMatch[4] as 'CAMS' | 'KFINTECH',
                isin: dataMatch[5],
            });
            i++;
        }

        return {
            holdings,
            totalMarketValue: this.parseIndianNumber(totalMatch[1]),
            totalCostValue: this.parseIndianNumber(totalMatch[2]),
        };
    }

    private parseLoadsAndFees(text: string): CasCamsLoadInfo[] {
        const loadsIdx = text.indexOf('Loads and Fees');
        if (loadsIdx === -1) return [];

        const loadsText = text.substring(loadsIdx + 'Loads and Fees'.length).trim();

        // Split on newline followed by scheme code pattern (e.g. "117TSD1G - ")
        const entries = loadsText.split(/\n(?=[A-Z0-9]+ - )/);
        const results: CasCamsLoadInfo[] = [];

        for (const entry of entries) {
            const colonIdx = entry.indexOf(' : ');
            if (colonIdx === -1) continue;

            const header = entry.substring(0, colonIdx);
            const rawText = entry.substring(colonIdx + 3).replace(/\n/g, ' ').trim();

            const codeMatch = header.match(/^([A-Z0-9]+) - (.+)$/);
            if (!codeMatch) continue;

            const schemeCode = codeMatch[1];
            const schemeName = codeMatch[2].trim();

            // Strip boilerplate suffixes before extracting loads
            const cleanText = rawText
                .replace(/Important\s+note\s*[-–]?\s*.*/i, '')
                .replace(/Please\s+ensure\s+that\s+your\s+account.*/i, '')
                .replace(/GST\s+Identification\s+Number.*/i, '')
                .replace(/Customers\s+may\s+request.*/i, '')
                .replace(/Kindly\s+ignore.*/i, '')
                .replace(/"Please\s+ensure.*/i, '')
                .trim();

            // Split on every "Entry Load" or "Exit Load" occurrence to get individual statements
            const entryLoadStatements: string[] = [];
            const exitLoadStatements: string[] = [];

            // Find all "Entry Load" / "Exit Load" positions
            const loadRegex = /(Entry\s+[Ll]oad|Exit\s+[Ll]oad)/gi;
            const positions: { type: 'entry' | 'exit'; start: number }[] = [];
            let m: RegExpExecArray | null;
            while ((m = loadRegex.exec(cleanText)) !== null) {
                positions.push({
                    type: m[1].toLowerCase().startsWith('entry') ? 'entry' : 'exit',
                    start: m.index,
                });
            }

            // Extract each statement: from its "Entry/Exit Load" to the next "Entry/Exit Load" or end
            for (let j = 0; j < positions.length; j++) {
                const pos = positions[j];
                const nextStart = j + 1 < positions.length ? positions[j + 1].start : cleanText.length;
                const segment = cleanText.substring(pos.start, nextStart).trim().replace(/[,;]\s*$/, '');

                // Remove the "Entry Load" / "Exit Load" prefix to get the value
                const value = segment
                    .replace(/^(?:Entry|Exit)\s+[Ll]oad\s*[-:;]?\s*/i, '')
                    .replace(/[,;]\s*$/, '')
                    .trim();

                if (!value) continue;

                if (pos.type === 'entry') {
                    entryLoadStatements.push(value);
                } else {
                    exitLoadStatements.push(value);
                }
            }

            // If no explicit "Entry/Exit Load" markers found, try "Current Load Structure" style
            if (entryLoadStatements.length === 0 && exitLoadStatements.length === 0 && positions.length === 0) {
                // Some entries just have plain text like "NIL" or percentage descriptions
                const nilMatch = cleanText.match(/^NIL[L]?\s*$/i);
                if (nilMatch) {
                    entryLoadStatements.push('NIL');
                    exitLoadStatements.push('NIL');
                }
            }

            // Extract lock-in period
            let lockInPeriod: string | null = null;
            const lockInMatch = rawText.match(/lock[- ]?in\s+period\s+(?:is\s+|of\s+)?(\d+\s*years?)/i);
            if (lockInMatch) {
                lockInPeriod = lockInMatch[1].trim();
            }

            results.push({ schemeCode, schemeName, entryLoadStatements, exitLoadStatements, lockInPeriod, rawText });
        }

        return results;
    }

    parseIndianNumber(str: string): number {
        return parseFloat(str.replace(/,/g, ''));
    }

    parseCamsDate(str: string): string {
        const months: Record<string, string> = {
            Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
            Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
        };
        const match = str.match(/(\d{1,2})-(\w{3})-(\d{4})/);
        if (!match) return str;
        const [, day, mon, year] = match;
        return `${year}-${months[mon] || '00'}-${day.padStart(2, '0')}`;
    }
}

export const casCamsParser = new CasCamsParserService();
