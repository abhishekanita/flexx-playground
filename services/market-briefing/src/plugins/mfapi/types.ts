export interface MFScheme {
	schemeCode: number;
	schemeName: string;
}

export interface NAVData {
	date: string;
	nav: number;
}

export interface SchemeDetails {
	meta: SchemeMeta;
	currentNAV: NAVData;
	data: NAVData[];
}

export interface SchemeMeta {
	fundHouse: string;
	schemeType: string;
	schemeCategory: string;
	schemeCode: number;
	schemeName: string;
}

export interface SchemeNAV {
	schemeCode: number;
	schemeName: string;
	fundHouse: string;
	schemeCategory: string;
	nav: number;
	date: string;
}

export interface NAVChange {
	schemeCode: number;
	schemeName: string;
	currentNAV: number;
	previousNAV: number;
	change: number;
	changePercent: number;
	period: string;
	currentDate: string;
	previousDate: string;
}

export interface MultipleNAVResult {
	schemeCode: number;
	schemeName: string;
	nav: number;
	date: string;
	error?: string;
}

export interface SchemeHistoryOptions {
	schemeCode: number;
	startDate?: Date;
	endDate?: Date;
}

export const MFAPI_BASE_URL = 'https://api.mfapi.in/mf';
