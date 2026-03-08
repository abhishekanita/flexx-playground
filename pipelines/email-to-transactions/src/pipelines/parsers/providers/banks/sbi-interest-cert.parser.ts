// SBI Interest Certificate PDF parser (stub)

export interface SbiInterestCert {
    accountNumber: string;
    financialYear: string;
    interestEarned: number;
    tdsDeducted: number;
}

export function parseSbiInterestCert(text: string): SbiInterestCert {
    const result: SbiInterestCert = {
        accountNumber: '',
        financialYear: '',
        interestEarned: 0,
        tdsDeducted: 0,
    };

    const acctMatch = text.match(/Account\s*(?:No|Number)\s*:?\s*(\d+)/i);
    if (acctMatch) result.accountNumber = acctMatch[1];

    const fyMatch = text.match(/(?:Financial Year|F\.?Y\.?)\s*:?\s*(\d{4}-\d{2,4})/i);
    if (fyMatch) result.financialYear = fyMatch[1];

    const intMatch = text.match(/(?:Interest\s*(?:Earned|Paid|Credited))\s*:?\s*(?:Rs\.?)?\s*([\d,]+\.?\d*)/i);
    if (intMatch) result.interestEarned = parseFloat(intMatch[1].replace(/,/g, '')) || 0;

    const tdsMatch = text.match(/TDS\s*(?:Deducted)?\s*:?\s*(?:Rs\.?)?\s*([\d,]+\.?\d*)/i);
    if (tdsMatch) result.tdsDeducted = parseFloat(tdsMatch[1].replace(/,/g, '')) || 0;

    return result;
}
