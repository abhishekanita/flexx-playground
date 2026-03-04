export interface GrowwAMC {
	slug: string;
	name: string;
	totalAum?: number;
	schemeCount?: number;
	lastLightSyncAt?: Date;
	lastDeepSyncAt?: Date | null;
}
