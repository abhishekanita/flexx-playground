export interface FICountdownResult {
    currentValue: number;
    monthlySIP: number;
    monthlyExpenses: number;
    swr: number; // e.g. 0.035
    fiTarget: number; // monthlyExpenses * 12 / swr
    progressPct: number; // currentValue / fiTarget * 100
    projections: FIProjection[];
}

export interface FIProjection {
    label: string;
    monthlySIP: number;
    annualRate: number; // percentage
    monthlyExpenses: number;
    fiTarget: number;
    monthsToFI: number;
    yearsToFI: number;
    projectedDate: string; // ISO date
    isBearCase: boolean;
    isBaseline: boolean;
}
