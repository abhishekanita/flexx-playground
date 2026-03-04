import { MFDetailedStatementData } from '@/types/statements';

export class DetailedStatementParser {
    constructor() {}

    public async parse(pdfBuffer: Buffer, password: string): Promise<MFDetailedStatementData> {
        const { pages, fullText } = await this.parsePdf(pdfBuffer, password);
        if (!pages.length) throw new Error('No pages found in PDF');

        // Strip repeated page headers and transaction table headers
        const stripped = fullText
            .replace(
                /CAMSCASWS-\S+ Version:.+\nConsolidated Account Statement\n\d{1,2}-\w{3}-\d{4} To \d{1,2}-\w{3}-\d{4}\nPage \d+ of \d+/g,
                ''
            )
            .replace(/\nDate Amount Price\tUnits\tTransaction Unit\n\(INR\) \(INR\) Balance\n/g, '');

        const { documentId, version } = this.parseDocumentHeader(fullText);
        const statementPeriod = this.parseStatementPeriod(fullText);
        const investor = this.parseInvestorInfo(stripped);
        const { portfolioSummary, totalCostValue, totalMarketValue } = this.parsePortfolioSummary(stripped);
        const folios = this.parseFolios(stripped);

        return {
            documentId,
            version,
            statementPeriod,
            investor,
            portfolioSummary,
            totalCostValue,
            totalMarketValue,
            folios,
        };
    }

    private parseDocumentHeader(text: string): { documentId: string; version: string } {
        const match = text.match(/^(CAMSCASWS-\S+)\s+Version:(.+)$/m);
        return {
            documentId: match?.[1] || '',
            version: match?.[2]?.trim() || '',
        };
    }

    private parseStatementPeriod(text: string): { from: string; to: string } {
        const match = text.match(/(\d{1,2}-\w{3}-\d{4}) To (\d{1,2}-\w{3}-\d{4})/);
        return {
            from: match ? this.parseCamsDate(match[1]) : '',
            to: match ? this.parseCamsDate(match[2]) : '',
        };
    }

    private parseInvestorInfo(text: string): MFDetailedStatementData['investor'] {
        const email = text.match(/Email Id:\s*(\S+)/)?.[1] || '';
        const mobile = text.match(/Mobile:\s*(\S+)/)?.[1] || '';
        const pan = text.match(/PAN:\s*(\w+)/)?.[1] || '';

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
                .filter(l => !l.startsWith('The Consolidated') && !l.startsWith('S/O:') && !l.startsWith('D/O:') && !l.startsWith('W/O:'))
                .map(l => l.trim())
                .filter(Boolean)
                .join(', ');
        }

        if (!address && guardianMatch) {
            const guardianLineIdx = lines.findIndex(l => l.match(/[SDWC]\/O:/));
            if (guardianLineIdx >= 0 && mobileLineIdx > guardianLineIdx) {
                const guardianLine = lines[guardianLineIdx];
                const afterGuardian = guardianLine.replace(/[SDWC]\/O:\s*[^,]+,/, '').trim();
                const restLines = lines.slice(guardianLineIdx + 1, mobileLineIdx);
                const parts = [afterGuardian, ...restLines.map(l => l.trim())].filter(Boolean);
                address = parts.join(', ');
            }
        }

        return { name, email, address, mobile, pan, guardianName };
    }

    private parsePortfolioSummary(text: string): {
        portfolioSummary: MFDetailedStatementData['portfolioSummary'];
        totalCostValue: number;
        totalMarketValue: number;
    } {
        const summaryStart = text.indexOf('PORTFOLIO SUMMARY');
        if (summaryStart === -1) return { portfolioSummary: [], totalCostValue: 0, totalMarketValue: 0 };

        const totalMatch = text.match(/^Total\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)/m);
        if (!totalMatch) return { portfolioSummary: [], totalCostValue: 0, totalMarketValue: 0 };

        const summaryText = text.substring(summaryStart + 'PORTFOLIO SUMMARY'.length, totalMatch.index!);
        const lines = summaryText.split('\n').filter(l => l.trim());
        const portfolioSummary: MFDetailedStatementData['portfolioSummary'] = [];
        const lineRegex = /^(.+?)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)$/;

        for (const line of lines) {
            const match = line.match(lineRegex);
            if (match) {
                portfolioSummary.push({
                    fundHouse: match[1].trim(),
                    costValue: this.parseIndianNumber(match[2]),
                    marketValue: this.parseIndianNumber(match[3]),
                });
            }
        }

        return {
            portfolioSummary,
            totalCostValue: this.parseIndianNumber(totalMatch[1]),
            totalMarketValue: this.parseIndianNumber(totalMatch[2]),
        };
    }

    private parseFolios(text: string): MFDetailedStatementData['folios'] {
        const totalMatch = text.match(/^Total\s+[\d,]+\.\d+\s+[\d,]+\.\d+/m);
        if (!totalMatch) return [];

        const schemesText = text.substring(totalMatch.index! + totalMatch[0].length);
        const fundHouseNames = this.extractFundHouseNames(text);

        // Match all PAN/KYC header variants:
        //   PAN: BWKPD0449P KYC: OK  PAN: OK     (full format)
        //   PAN: BWKPD0449P   PAN: OK             (no KYC)
        //   KYC: NOT OK  PAN: NOT OK              (no PAN number)
        const panPattern = /^(?:PAN:\s*[A-Z\d]+\s+)?(?:KYC:\s*(?:OK|NOT\s+OK)\s+)?PAN:\s*(?:OK|NOT\s+OK)\s*$/m;
        const blocks: { fundHouse: string; text: string }[] = [];
        const lines = schemesText.split('\n');
        let currentFundHouse = '';
        let currentBlockLines: string[] = [];
        let inBlock = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            const matchedFundHouse = fundHouseNames.find(fh => line.trim() === fh);
            if (matchedFundHouse) {
                currentFundHouse = matchedFundHouse;
                continue;
            }

            if (panPattern.test(line)) {
                if (inBlock && currentBlockLines.length > 0) {
                    blocks.push({ fundHouse: currentFundHouse, text: currentBlockLines.join('\n') });
                }
                currentBlockLines = [line];
                inBlock = true;
                continue;
            }

            if (inBlock) {
                currentBlockLines.push(line);
                if (line.match(/^Closing Unit Balance:\s*[\d,]+\.\d+\s+Total Cost Value:\s*[\d,]+\.\d+/)) {
                    blocks.push({ fundHouse: currentFundHouse, text: currentBlockLines.join('\n') });
                    currentBlockLines = [];
                    inBlock = false;
                }
            }
        }

        const folios: MFDetailedStatementData['folios'] = [];
        for (const block of blocks) {
            const folio = this.parseFolioBlock(block.text, block.fundHouse);
            if (folio) folios.push(folio);
        }

        return folios;
    }

    private extractFundHouseNames(text: string): string[] {
        const summaryStart = text.indexOf('PORTFOLIO SUMMARY');
        const totalMatch = text.match(/^Total\s+[\d,]+\.\d+\s+[\d,]+\.\d+/m);
        if (summaryStart === -1 || !totalMatch) return [];

        const summaryText = text.substring(summaryStart + 'PORTFOLIO SUMMARY'.length, totalMatch.index!);
        const lineRegex = /^(.+?)\s+[\d,]+\.\d+\s+[\d,]+\.\d+$/;
        const names: string[] = [];

        for (const line of summaryText.split('\n')) {
            const match = line.match(lineRegex);
            if (match) names.push(match[1].trim());
        }

        return names;
    }

    private parseFolioBlock(text: string, fundHouse: string): MFDetailedStatementData['folios'][0] | null {
        if (!text.trim()) return null;
        const lines = text.split('\n');

        // Parse PAN/KYC/PAN status — handles all three format variants
        const firstLine = lines[0] || '';
        const panNumberMatch = firstLine.match(/^PAN:\s*([A-Z]{5}\d{4}[A-Z])/);
        const pan = panNumberMatch?.[1] || '';
        const kycOk = /KYC:\s*OK/.test(firstLine);
        const panOk = /PAN:\s*OK\s*$/.test(firstLine);

        // Parse scheme info - keep reading until we find the registrar value
        let schemeText = '';
        for (let i = 1; i < lines.length; i++) {
            schemeText += (schemeText ? ' ' : '') + lines[i].trim();
            if (schemeText.match(/Registrar\s*:\s*(CAMS|KFINTECH)/)) break;
            if (lines[i].trim().startsWith('Folio No:')) break;
        }

        const schemeCodeMatch = schemeText.match(/^(\w+)\s*-\s*(.+?)(?:\s*-\s*)?ISIN:\s*(\w+)\(Advisor:\s*([^)]+)\)/);
        const registrarMatch = schemeText.match(/Registrar\s*:\s*(CAMS|KFINTECH)/);

        const schemeCode = schemeCodeMatch?.[1] || '';
        const rawSchemeName = schemeCodeMatch?.[2]?.replace(/\s*-\s*$/, '').trim() || '';
        const isin = schemeCodeMatch?.[3] || '';
        const advisor = schemeCodeMatch?.[4] || '';
        const registrar = (registrarMatch?.[1] || 'CAMS') as 'CAMS' | 'KFINTECH';

        // Extract plan, option, dematStatus, current_name from raw scheme name
        const plan = /Direct/i.test(rawSchemeName) ? ('Direct' as const) : ('Regular' as const);
        const option = this.extractOption(rawSchemeName);
        const dematStatus = /\(Non-Demat\)/i.test(rawSchemeName)
            ? ('Non-Demat' as const)
            : /\(Demat\)/i.test(rawSchemeName)
            ? ('Demat' as const)
            : ('Non-Demat' as const);
        const currentName = this.extractCurrentName(rawSchemeName);

        // Parse folio
        const folioLine = lines.find(l => l.match(/^Folio No:/));
        const folioNumber = folioLine?.match(/Folio No:\s*(.+)/)?.[1]?.trim() || '';

        // Parse holder name (line after folio)
        const folioIdx = lines.findIndex(l => l.match(/^Folio No:/));
        const holderName = folioIdx >= 0 ? lines[folioIdx + 1]?.trim() || '' : '';

        // Parse nominees
        const nomineeLine = lines.find(l => l.startsWith('Nominee 1:'));
        const nominees: string[] = [];
        if (nomineeLine) {
            const parts = nomineeLine.split(/Nominee \d+:\s*/);
            for (const part of parts) {
                const trimmed = part.trim();
                if (trimmed) nominees.push(trimmed);
            }
        }

        // Parse opening/closing unit balance
        const openingMatch = text.match(/Opening Unit Balance:\s*([\d,]+\.\d+)/);
        const openingUnitBalance = openingMatch ? this.parseIndianNumber(openingMatch[1]) : 0;

        const closingMatch = text.match(/Closing Unit Balance:\s*([\d,]+\.\d+)\s+Total Cost Value:\s*([\d,]+\.\d+)/);
        const closingUnitBalance = closingMatch ? this.parseIndianNumber(closingMatch[1]) : 0;
        const totalCostValue = closingMatch ? this.parseIndianNumber(closingMatch[2]) : 0;

        // Parse NAV snapshot
        const navMatch = text.match(
            /NAV on (\d{1,2}-\w{3}-\d{4}):\s*INR\s*([\d,.]+)\s*Market Value on \d{1,2}-\w{3}-\d{4}:\s*INR\s*([\d,]+\.\d+)/
        );
        const navDate = navMatch ? this.parseCamsDate(navMatch[1]) : '';
        const nav = navMatch ? parseFloat(navMatch[2]) : 0;
        const marketValue = navMatch ? this.parseIndianNumber(navMatch[3]) : 0;

        // Parse transactions
        const { transactions, stampDutyTotal } = this.parseTransactions(text);

        // Parse load info
        const navLineIdx = text.indexOf('NAV on ');
        const closingLineIdx = text.indexOf('Closing Unit Balance:');
        let loadInfo = '';
        if (navLineIdx >= 0 && closingLineIdx > navLineIdx) {
            const afterNav = text.substring(navLineIdx, closingLineIdx);
            const navLineEnd = afterNav.indexOf('\n');
            if (navLineEnd >= 0) {
                loadInfo = afterNav.substring(navLineEnd + 1).trim();
            }
        }

        return {
            fundHouse,
            folioNumber,
            scheme: {
                schemeName: rawSchemeName,
                scheme_code: schemeCode,
                isin,
                current_name: currentName,
                plan,
                option,
                dematStatus,
                registrar,
                loadDetails: loadInfo || null,
                advisor,
            },
            investor: {
                holderName,
                pan,
                nominees,
                kycOk,
                panOk,
            },
            openingUnitBalance,
            closingUnitBalance,
            snapshot: {
                navDate,
                nav,
                totalCostValue,
                marketValue,
            },
            transactions,
            stampDutyTotal,
            loadInfo,
        };
    }

    private parseTransactions(text: string): {
        transactions: MFDetailedStatementData['folios'][0]['transactions'];
        stampDutyTotal: number;
    } {
        const transactions: MFDetailedStatementData['folios'][0]['transactions'] = [];
        let stampDutyTotal = 0;

        if (text.includes('*** No transactions during this statement period ***')) {
            return { transactions, stampDutyTotal };
        }

        const lines = text.split('\n');
        const openingIdx = lines.findIndex(l => l.match(/^Opening Unit Balance:/));
        const navIdx = lines.findIndex(l => l.match(/^NAV on /));
        if (openingIdx < 0 || navIdx < 0) return { transactions, stampDutyTotal };

        const txLines = lines.slice(openingIdx + 1, navIdx);

        // Standard transaction: date amount nav\tunits\ttype balance
        const txRegex = /^(\d{1,2}-\w{3}-\d{4})\s+([\d,]+\.\d+)\s+([\d.]+)\t([\d,]+\.\d+)\t(.+?)\s+([\d,]+\.\d+)$/;
        // Redemption prefix: date (amount) nav (units) — captures the numeric parts
        // The type text and unit balance may follow on the same line or subsequent lines
        const redeemPrefixRegex = /^(\d{1,2}-\w{3}-\d{4})\s+\(([\d,]+\.\d+)\)\s+([\d.]+)\s+\(([\d,]+\.\d+)\)\s*(.*?)\s*$/;
        // Standalone stamp duty line
        const stampRegex = /^(\d{1,2}-\w{3}-\d{4})\s+([\d,]+\.\d+)\s*$/;

        for (let i = 0; i < txLines.length; i++) {
            const line = txLines[i];

            // Skip info lines
            if (line.includes('***') && !line.includes('Stamp Duty') && !line.includes('STT')) continue;
            if (line.startsWith(' ') && !line.match(/^\s+\d/)) continue;

            // Try standard purchase format
            const txMatch = line.match(txRegex);
            if (txMatch) {
                const rawType = txMatch[5].trim();
                const { type, channel, advisorCode } = this.classifyTransaction(rawType);

                // Look ahead for stamp duty on next lines
                let stampDuty: number | null = null;
                if (i + 1 < txLines.length) {
                    const nextLine = txLines[i + 1];
                    const stampMatch = nextLine.match(stampRegex);
                    if (stampMatch) {
                        stampDuty = this.parseIndianNumber(stampMatch[2]);
                        stampDutyTotal += stampDuty;
                        i++;
                        if (i + 1 < txLines.length && txLines[i + 1].includes('*** Stamp Duty ***')) {
                            i++;
                        }
                    }
                }

                const amount = this.parseIndianNumber(txMatch[2]);
                const price = parseFloat(txMatch[3]);
                const units = this.parseIndianNumber(txMatch[4]);
                const unitBalance = this.parseIndianNumber(txMatch[6]);

                transactions.push({
                    date: this.parseCamsDate(txMatch[1]),
                    type,
                    channel: channel || null,
                    advisorCode: advisorCode || null,
                    amount,
                    nav: price,
                    units,
                    unitBalanceAfter: unitBalance,
                    stampDuty,
                });
                continue;
            }

            // Try redemption format: date (amount) nav (units) [type] [balance]
            // Type text and balance may be on the same line, spread across continuation lines,
            // or start entirely on the next line
            const redeemMatch = line.match(redeemPrefixRegex);
            if (redeemMatch) {
                let remainder = redeemMatch[5]?.trim() || '';
                let rawType = '';
                let unitBalance = 0;

                // Try to extract balance from the remainder on the same line
                const sameLineBalMatch = remainder.match(/^(.+?)\s+([\d,]+\.\d+)\s*$/);
                if (sameLineBalMatch && sameLineBalMatch[1].trim().length > 0) {
                    // Single-line: "Redemption less TDS, STT 0.000"
                    rawType = sameLineBalMatch[1].trim();
                    unitBalance = this.parseIndianNumber(sameLineBalMatch[2]);
                } else {
                    // Multi-line or split-line: read continuation lines
                    rawType = remainder;
                    let j = i + 1;
                    while (j < txLines.length) {
                        const contLine = txLines[j].trim();
                        if (!contLine) { j++; continue; }
                        // Skip asterisk info lines (but not stamp duty / STT)
                        if (contLine.startsWith('***') && !contLine.includes('Stamp Duty') && !contLine.includes('STT')) { j++; continue; }
                        // Check if this is a stamp duty line (date + small amount) — means we're past the transaction
                        if (contLine.match(/^\d{1,2}-\w{3}-\d{4}\s+[\d.]+\s*$/)) break;
                        // Check if this is a new transaction line
                        if (contLine.match(/^\d{1,2}-\w{3}-\d{4}\s+[\d,(]/)) break;

                        // Check if this line is just the unit balance number
                        const balMatch = contLine.match(/^([\d,]+\.\d+)\s*$/);
                        if (balMatch) {
                            unitBalance = this.parseIndianNumber(balMatch[1]);
                            i = j;
                            break;
                        }
                        // Check if type text ends with a balance number
                        const contBalMatch = contLine.match(/^(.+?)\s+([\d,]+\.\d+)\s*$/);
                        if (contBalMatch) {
                            rawType += ' ' + contBalMatch[1].trim();
                            unitBalance = this.parseIndianNumber(contBalMatch[2]);
                            i = j;
                            break;
                        }
                        // Pure continuation text (e.g. "less TDS, STT")
                        rawType += ' ' + contLine;
                        j++;
                    }
                    // If we didn't find a balance, the loop ended — set i to the last read line
                    if (unitBalance === 0 && j > i + 1) i = j - 1;
                }

                rawType = rawType.replace(/^\*/, '').trim(); // strip leading asterisk
                const { type, channel, advisorCode } = this.classifyTransaction(rawType);

                // Look ahead for STT/stamp duty
                let stampDuty: number | null = null;
                if (i + 1 < txLines.length) {
                    const nextLine = txLines[i + 1];
                    const stampMatch = nextLine.match(stampRegex);
                    if (stampMatch) {
                        stampDuty = this.parseIndianNumber(stampMatch[2]);
                        stampDutyTotal += stampDuty;
                        i++;
                        if (i + 1 < txLines.length && (txLines[i + 1].includes('*** STT Paid ***') || txLines[i + 1].includes('*** Stamp Duty ***'))) {
                            i++;
                        }
                    }
                }

                transactions.push({
                    date: this.parseCamsDate(redeemMatch[1]),
                    type,
                    channel: channel || null,
                    advisorCode: advisorCode || null,
                    amount: -this.parseIndianNumber(redeemMatch[2]),
                    nav: parseFloat(redeemMatch[3]),
                    units: -this.parseIndianNumber(redeemMatch[4]),
                    unitBalanceAfter: unitBalance,
                    stampDuty,
                });
                continue;
            }

            // Standalone stamp duty line
            const stampMatch = line.match(stampRegex);
            if (stampMatch) {
                stampDutyTotal += this.parseIndianNumber(stampMatch[2]);
            }
        }

        return { transactions, stampDutyTotal };
    }

    private classifyTransaction(rawType: string): {
        type:
            | 'Purchase'
            | 'Redemption'
            | 'SIP'
            | 'SIP Redemption'
            | 'Switch In'
            | 'Switch Out'
            | 'STP In'
            | 'STP Out'
            | 'SWP'
            | 'Dividend Reinvestment'
            | 'Dividend Payout'
            | 'NFO Allotment'
            | 'Bonus'
            | 'Merger'
            | 'Stamp Duty';
        channel?: string;
        advisorCode?: string;
    } {
        // Extract advisor code (e.g. "INZ000208032")
        const advisorMatch = rawType.match(/(INZ\w+)/);
        const advisorCode = advisorMatch?.[1];

        // Extract channel
        let channel: string | undefined;
        if (/BSE/i.test(rawType)) channel = 'BSE';
        else if (/NSE/i.test(rawType)) channel = 'NSE';
        else if (/Online/i.test(rawType)) channel = 'Online';
        else if (/Demat/i.test(rawType)) channel = 'Demat';

        // Classify type
        if (/Systematic Investment|^SIP\b|Sys\.\s*Investment|SIP Instalment/i.test(rawType)) return { type: 'SIP', channel, advisorCode };
        if (/SIP Redemption/i.test(rawType)) return { type: 'SIP Redemption', channel, advisorCode };
        if (/Switch\s*In/i.test(rawType)) return { type: 'Switch In', channel, advisorCode };
        if (/Switch\s*Out/i.test(rawType)) return { type: 'Switch Out', channel, advisorCode };
        if (/STP\s*In/i.test(rawType)) return { type: 'STP In', channel, advisorCode };
        if (/STP\s*Out/i.test(rawType)) return { type: 'STP Out', channel, advisorCode };
        if (/\bSWP\b/i.test(rawType)) return { type: 'SWP', channel, advisorCode };
        if (/Dividend\s*Reinvest/i.test(rawType)) return { type: 'Dividend Reinvestment', channel, advisorCode };
        if (/Dividend\s*Payout/i.test(rawType)) return { type: 'Dividend Payout', channel, advisorCode };
        if (/NFO/i.test(rawType)) return { type: 'NFO Allotment', channel, advisorCode };
        if (/Bonus/i.test(rawType)) return { type: 'Bonus', channel, advisorCode };
        if (/Merger|Consolidat/i.test(rawType)) return { type: 'Merger', channel, advisorCode };
        if (/Stamp\s*Duty/i.test(rawType)) return { type: 'Stamp Duty', channel, advisorCode };
        if (/\*?Redemption/i.test(rawType)) return { type: 'Redemption', channel, advisorCode };

        // Default: Purchase (covers "Purchase-BSE", "Additional Purchase", etc.)
        return { type: 'Purchase', channel, advisorCode };
    }

    private extractOption(
        schemeName: string
    ): 'Growth' | 'Dividend - Payout' | 'Dividend - Reinvestment' | 'IDCW - Payout' | 'IDCW - Reinvestment' {
        if (/IDCW.*Reinvest/i.test(schemeName)) return 'IDCW - Reinvestment';
        if (/IDCW.*Payout/i.test(schemeName)) return 'IDCW - Payout';
        if (/Dividend.*Reinvest/i.test(schemeName)) return 'Dividend - Reinvestment';
        if (/Dividend.*Payout/i.test(schemeName)) return 'Dividend - Payout';
        return 'Growth';
    }

    private extractCurrentName(rawSchemeName: string): string {
        // Remove parenthetical historical names like "(erstwhile ...)" or "(formerly ...)"
        let name = rawSchemeName
            .replace(/\s*\(erstwhile[^)]*\)/gi, '')
            .replace(/\s*\(formerly[^)]*\)/gi, '')
            .replace(/\s*\(Non-Demat\)/gi, '')
            .replace(/\s*\(Demat\)/gi, '')
            .replace(/\s*-\s*Direct Plan\s*/gi, ' ')
            .replace(/\s*-\s*Regular Plan\s*/gi, ' ')
            .replace(/\s*Direct\s*Plan\s*/gi, ' ')
            .replace(/\s*-\s*Growth\s*(Option)?\s*/gi, ' ')
            .replace(/\s*-\s*Growth\s*/gi, ' ')
            .replace(/\s*Growth\s*/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        // Remove trailing hyphens
        name = name.replace(/\s*-\s*$/, '').trim();

        return name;
    }

    parseIndianNumber(str: string): number {
        return parseFloat(str.replace(/,/g, ''));
    }

    parseCamsDate(str: string): string {
        const months: Record<string, string> = {
            Jan: '01',
            Feb: '02',
            Mar: '03',
            Apr: '04',
            May: '05',
            Jun: '06',
            Jul: '07',
            Aug: '08',
            Sep: '09',
            Oct: '10',
            Nov: '11',
            Dec: '12',
        };
        const match = str.match(/(\d{1,2})-(\w{3})-(\d{4})/);
        if (!match) return str;
        const [, day, mon, year] = match;
        return `${year}-${months[mon] || '00'}-${day.padStart(2, '0')}`;
    }

    async parsePdf(pdfBuffer: Buffer, password: string): Promise<{ fullText: string; pages: { text: string; num: number }[] }> {
        console.log('password', password);
        const { PDFParse } = require('pdf-parse');
        const parser = new PDFParse({ data: new Uint8Array(pdfBuffer), password });
        await parser.load();
        const result = await parser.getText();
        await parser.destroy();
        const pages = result.pages;

        const sorted = [...pages].sort((a, b) => a.num - b.num);
        const fullText = pages.map(p => p.text).join('\n');
        return { fullText, pages: sorted };
    }
}
