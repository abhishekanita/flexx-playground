// NSDL Consolidated Account Statement (CAS) PDF parser
// Extracts: portfolio summary, demat holdings (equities + MFs), transactions

export interface NsdlCasEquityHolding {
    isin: string;
    stockSymbol: string;
    companyName: string;
    faceValue: number;
    shares: number;
    marketPrice: number;
    value: number;
}

export interface NsdlCasMfHolding {
    isin: string;
    schemeName: string;
    units: number;
    lockedInUnits: number;
    nav: number;
    value: number;
}

export interface NsdlCasDematAccount {
    dpName: string;
    dpId: string;
    clientId: string;
    equities: NsdlCasEquityHolding[];
    mutualFunds: NsdlCasMfHolding[];
    total: number;
}

export interface NsdlCasTransaction {
    isin: string;
    securityName: string;
    date: string; // YYYY-MM-DD
    orderNo: string;
    description: string;
    openingBalance: number;
    debit: number;
    credit: number;
    closingBalance: number;
}

export interface NsdlCasPortfolioTrend {
    month: string;
    value: number;
    changeAmount: number;
    changePercent: number;
}

export interface NsdlCasStatement {
    nsdlId: string;
    holderName: string;
    statementPeriod: string;
    portfolioValue: number;
    portfolioComposition: Record<string, { value: number; percent: number }>;
    dematAccounts: NsdlCasDematAccount[];
    transactions: NsdlCasTransaction[];
    portfolioTrend: NsdlCasPortfolioTrend[];
    dob: string;
}

function parseAmount(s: string): number {
    return parseFloat(s.replace(/[`,\s]/g, '')) || 0;
}

function parseDate(s: string): string {
    // DD-Mon-YYYY → YYYY-MM-DD
    const months: Record<string, string> = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
        'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12',
    };
    const m = s.match(/(\d{2})-(\w{3})-(\d{4})/);
    if (m) return `${m[3]}-${months[m[2]] || '01'}-${m[1]}`;
    return s;
}

export function parseNsdlCas(text: string): NsdlCasStatement {
    const result: NsdlCasStatement = {
        nsdlId: '',
        holderName: '',
        statementPeriod: '',
        portfolioValue: 0,
        portfolioComposition: {},
        dematAccounts: [],
        transactions: [],
        portfolioTrend: [],
        dob: '',
    };

    // NSDL ID
    const nsdlMatch = text.match(/NSDL ID:\s*(\d+)/);
    if (nsdlMatch) result.nsdlId = nsdlMatch[1];

    // Holder name
    const nameMatch = text.match(/NSDL ID:\s*\d+\s*\n([A-Z][A-Z ]+[A-Z])\n/);
    if (nameMatch) result.holderName = nameMatch[1].trim();

    // Statement period
    const periodMatch = text.match(/Statement for the period from\s+(.+)/);
    if (periodMatch) result.statementPeriod = periodMatch[1].trim();

    // Portfolio value
    const pvMatch = text.match(/PORTFOLIO VALUE\s*`\s*([\d,]+\.\d+)/);
    if (pvMatch) result.portfolioValue = parseAmount(pvMatch[1]);

    // DOB
    const dobMatch = text.match(/DATE OF BIRTH\s*\(DD\/MM\/YYYY\)\s*(\d{2}\/\d{2}\/\d{4})/);
    if (dobMatch) result.dob = dobMatch[1];

    // Portfolio composition
    const compRegex = /^(Equities|Preference Shares|Mutual Funds|Alternate Investment|Corporate Bonds|Zero Coupon|Money Market|Securitised|Government Securities|Postal Saving|Mutual Fund Folios|National Pension)\s*\([A-Z]\)\s*([\d,]+\.\d+)\s+([\d.]+)%/gm;
    let compMatch;
    while ((compMatch = compRegex.exec(text)) !== null) {
        result.portfolioComposition[compMatch[1]] = {
            value: parseAmount(compMatch[2]),
            percent: parseFloat(compMatch[3]),
        };
    }

    // Portfolio trend
    const trendRegex = /^((?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{4})\s+([\d,]+\.\d+)\s+([+-]?\d[\d,.]*)\s+([+-]?\d[\d.]*)/gm;
    let trendMatch;
    while ((trendMatch = trendRegex.exec(text)) !== null) {
        result.portfolioTrend.push({
            month: trendMatch[1],
            value: parseAmount(trendMatch[2]),
            changeAmount: parseAmount(trendMatch[3]),
            changePercent: parseFloat(trendMatch[4]),
        });
    }

    // Parse demat accounts
    const dematSections = text.split(/(?=(?:NSDL|CDSL) Demat Account\n)/);
    for (const section of dematSections) {
        const headerMatch = section.match(/^(NSDL|CDSL) Demat Account\n(.+)\nDP ID:\s*(\S+)\s+Client ID:\s*(\S+)/);
        if (!headerMatch) continue;

        const account: NsdlCasDematAccount = {
            dpName: headerMatch[2].trim(),
            dpId: headerMatch[3],
            clientId: headerMatch[4],
            equities: [],
            mutualFunds: [],
            total: 0,
        };

        // Parse equities - ISIN on one line, details on next
        // Format: ISIN\nSTOCK.EXCHANGE COMPANY NAME faceValue shares marketPrice value
        const eqRegex = /(INE\w+)\n(\w+\.(?:NSE|BSE))\s+(.+?)\s+(\d+\.\d+)\s+(\d+)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)/g;
        let eqMatch;
        while ((eqMatch = eqRegex.exec(section)) !== null) {
            account.equities.push({
                isin: eqMatch[1],
                stockSymbol: eqMatch[2],
                companyName: eqMatch[3].trim(),
                faceValue: parseFloat(eqMatch[4]),
                shares: parseInt(eqMatch[5]),
                marketPrice: parseAmount(eqMatch[6]),
                value: parseAmount(eqMatch[7]),
            });
        }

        // Parse mutual funds - handle both NSDL and CDSL formats
        const foundMfs = new Set<string>();
        const lines = section.split('\n');

        // Detect CDSL format: has "SECURITY Current Bal." header
        const isCdsl = section.includes('Current Bal.');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const isinMatch = line.match(/^(INF\w+)\s+(.+)/);
            if (!isinMatch) continue;

            const isin = isinMatch[1];
            if (foundMfs.has(isin)) continue;

            let schemeName = isinMatch[2].trim();
            let units = 0, lockedIn = 0, nav = 0, value = 0;

            if (isCdsl) {
                // CDSL format: ISIN FUND_NAME units (may wrap to next line)
                // Then 8 lines of balances (free, lent, safekeep, lockedin, pledge setup, pledged, earmarked, pledgee)
                // Then last line: marketPrice value

                // Extract units from end of scheme name or next line
                const unitsInLine = schemeName.match(/^(.+?)\s+([\d,]+\.\d{3})$/);
                if (unitsInLine) {
                    schemeName = unitsInLine[1].trim();
                    units = parseAmount(unitsInLine[2]);
                } else {
                    // Name continues on next line
                    let j = i + 1;
                    while (j < lines.length) {
                        const nextLine = lines[j].trim();
                        const unitsMatch = nextLine.match(/^(.+?)\s+([\d,]+\.\d{3})$/);
                        if (unitsMatch) {
                            schemeName += ' ' + unitsMatch[1];
                            units = parseAmount(unitsMatch[2]);
                            i = j; // advance outer loop
                            break;
                        }
                        j++;
                    }
                }

                // Skip 8 balance lines + find nav/value line
                let j = i + 1;
                let balanceLines = 0;
                while (j < lines.length && balanceLines < 9) {
                    const trimmed = lines[j].trim();
                    if (trimmed.match(/^[\d,]+\.\d{3}$/)) {
                        balanceLines++;
                    } else if (trimmed.match(/^[\d,.]+\s+[\d,]+\.\d+$/)) {
                        // NAV and value line
                        const nvMatch = trimmed.match(/([\d,.]+)\s+([\d,]+\.\d+)/);
                        if (nvMatch) {
                            nav = parseFloat(nvMatch[1]);
                            value = parseAmount(nvMatch[2]);
                        }
                        break;
                    }
                    j++;
                }
            } else {
                // NSDL format: ISIN SCHEME_NAME\n[of which locked-in\n]units\n[lockedUnits\n]nav value
                const numMatch = schemeName.match(/^(.+?)\s+([\d,]+\.\d{3})\s+([\d.]+)\s+([\d,]+\.\d+)$/);
                if (numMatch) {
                    schemeName = numMatch[1].trim();
                    units = parseAmount(numMatch[2]);
                    nav = parseFloat(numMatch[3]);
                    value = parseAmount(numMatch[4]);
                } else {
                    let j = i + 1;
                    // Collect continuation of scheme name
                    while (j < lines.length && !lines[j].match(/^[\d,]+\.\d{3}/) && !lines[j].match(/of which locked/) && lines[j].trim() && !lines[j].match(/^Sub Total|^Total/)) {
                        schemeName += ' ' + lines[j].trim();
                        j++;
                    }
                    // Check for "of which locked-in"
                    if (j < lines.length && /of which locked/.test(lines[j])) j++;
                    // Read units
                    if (j < lines.length) {
                        const uMatch = lines[j].trim().match(/^([\d,]+\.\d{3})/);
                        if (uMatch) { units = parseAmount(uMatch[1]); j++; }
                    }
                    // Skip locked-in units line
                    if (j < lines.length && lines[j].trim().match(/^[\d,]+\.\d{3}$/)) {
                        lockedIn = parseAmount(lines[j].trim());
                        j++;
                    }
                    // Read NAV and value
                    if (j < lines.length) {
                        const navLine = lines[j].trim();
                        const nvMatch = navLine.match(/([\d,.]+)\s+([\d,]+\.\d+)/);
                        if (nvMatch) {
                            nav = parseFloat(nvMatch[1].replace(/,/g, ''));
                            value = parseAmount(nvMatch[2]);
                        }
                    }
                }
            }

            if (units > 0) {
                foundMfs.add(isin);
                account.mutualFunds.push({
                    isin,
                    schemeName: schemeName.replace(/\s+/g, ' ').trim(),
                    units,
                    lockedInUnits: lockedIn,
                    nav,
                    value,
                });
            }
        }

        // Total
        const totalMatch = section.match(/(?:Sub )?Total\s+([\d,]+\.\d+)/);
        if (totalMatch) account.total = parseAmount(totalMatch[1]);

        if (account.equities.length > 0 || account.mutualFunds.length > 0) {
            result.dematAccounts.push(account);
        }
    }

    // Parse transactions — they appear after "***End of Statement***"
    const txnStart = text.indexOf('***End of Statement***');
    if (txnStart >= 0) {
        const txnText = text.substring(txnStart);
        // Split by ISIN headers
        const isinBlocks = txnText.split(/ISIN\s*:\s*(IN[EF]\w+)\s*-\s*(.+)/);
        for (let i = 1; i < isinBlocks.length; i += 3) {
            const isin = isinBlocks[i];
            const securityName = isinBlocks[i + 1]?.trim() || '';
            const block = isinBlocks[i + 2] || '';

            // Each transaction starts with DD-Mon-YYYY and the balances are at end
            // Multi-line format: date orderNo description...\nopenBal debit credit closeBal
            const txnRegex = /(\d{2}-\w{3}-\d{4})\s+(\d+)\s+([\s\S]*?)(\d[\d,.]*)\s+(\d[\d,.]*)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s*(?:\n|$)/g;
            let txMatch;
            while ((txMatch = txnRegex.exec(block)) !== null) {
                result.transactions.push({
                    isin,
                    securityName,
                    date: parseDate(txMatch[1]),
                    orderNo: txMatch[2],
                    description: txMatch[3].replace(/\s+/g, ' ').trim(),
                    openingBalance: parseAmount(txMatch[4]),
                    debit: parseAmount(txMatch[5]),
                    credit: parseAmount(txMatch[6]),
                    closingBalance: parseAmount(txMatch[7]),
                });
            }
        }
    }

    return result;
}
