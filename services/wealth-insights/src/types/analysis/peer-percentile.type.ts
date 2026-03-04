export interface PeerPercentileResult {
    overallPercentile: number; // 0-100
    personality: string; // reused from uniqueNumbers.investorType
    dimensions: PeerDimension[];
    cohortSize: number;
}

export interface PeerDimension {
    key: 'discipline' | 'returns' | 'diversification' | 'consistency';
    label: string;
    userValue: number;
    percentile: number; // 0-100
    weight: number; // 0-1
    description: string;
}
