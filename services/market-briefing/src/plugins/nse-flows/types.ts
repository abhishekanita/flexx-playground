export interface InstitutionalFlow {
	buyValue: number; // ₹ crores
	sellValue: number;
	netValue: number;
}

export interface FIIDIIFlowData {
	date: string;
	fii: InstitutionalFlow;
	dii: InstitutionalFlow;
	fetchedAt: Date;
	source: 'scraper-api' | 'puppeteer';
}

export type FlowDirection = 'heavy-buying' | 'buying' | 'neutral' | 'selling' | 'heavy-selling';

export interface FIIDIITrend {
	today: FIIDIIFlowData | null;
	direction: FlowDirection;
	netFII: number;
	netDII: number;
	narrative: string;
}
