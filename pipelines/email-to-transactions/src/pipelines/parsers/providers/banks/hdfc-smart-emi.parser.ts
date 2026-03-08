// HDFC SmartEMI Loan Amortization Schedule PDF parser (stub)

export interface HdfcSmartEmiSchedule {
    cardLast4: string;
    loanId: string;
    emiAmount: number;
    tenure: number;
    interestRate: number;
    principalAmount: number;
    schedule: Array<{
        installment: number;
        dueDate: string;
        emiAmount: number;
        principal: number;
        interest: number;
        outstandingBalance: number;
    }>;
}

export function parseHdfcSmartEmi(text: string): HdfcSmartEmiSchedule {
    const result: HdfcSmartEmiSchedule = {
        cardLast4: '',
        loanId: '',
        emiAmount: 0,
        tenure: 0,
        interestRate: 0,
        principalAmount: 0,
        schedule: [],
    };

    const cardMatch = text.match(/Card\s*(?:No|Number)?\s*:?\s*\*{0,}(\d{4})/i);
    if (cardMatch) result.cardLast4 = cardMatch[1];

    const loanMatch = text.match(/Loan\s*(?:ID|Reference)\s*:?\s*(\S+)/i);
    if (loanMatch) result.loanId = loanMatch[1];

    const emiMatch = text.match(/EMI\s*Amount\s*:?\s*(?:Rs\.?)?\s*([\d,]+\.?\d*)/i);
    if (emiMatch) result.emiAmount = parseFloat(emiMatch[1].replace(/,/g, '')) || 0;

    const tenureMatch = text.match(/Tenure\s*:?\s*(\d+)/i);
    if (tenureMatch) result.tenure = parseInt(tenureMatch[1]);

    return result;
}
