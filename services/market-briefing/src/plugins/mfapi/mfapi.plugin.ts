import axios from 'axios';
import logger from '@/utils/logger';
import type {
	MFScheme,
	SchemeDetails,
	SchemeNAV,
	NAVChange,
	MultipleNAVResult,
	SchemeHistoryOptions,
	NAVData,
} from './types';
import { MFAPI_BASE_URL } from './types';

const log = logger.createServiceLogger('MFAPIPlugin');

export class MFAPIPlugin {
	private schemesCache: MFScheme[] | null = null;
	private schemesCacheTime = 0;
	private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

	/**
	 * Get current NAV and metadata for a mutual fund scheme.
	 */
	async getSchemeNAV(schemeCode: number): Promise<SchemeNAV> {
		log.info(`Fetching NAV for scheme ${schemeCode}`);

		try {
			const { data } = await axios.get<any>(`${MFAPI_BASE_URL}/${schemeCode}/latest`);

			const meta = data.meta || {};
			const navData = data.data?.[0];

			return {
				schemeCode: meta.scheme_code || schemeCode,
				schemeName: meta.scheme_name || '',
				fundHouse: meta.fund_house || '',
				schemeCategory: meta.scheme_category || '',
				nav: navData ? parseFloat(navData.nav) : 0,
				date: navData?.date || '',
			};
		} catch (err) {
			log.error(`Failed to fetch NAV for scheme ${schemeCode}`, err);
			throw err;
		}
	}

	/**
	 * Get full scheme details including metadata and historical NAV data.
	 */
	async getSchemeDetails(schemeCode: number): Promise<SchemeDetails> {
		log.info(`Fetching scheme details for ${schemeCode}`);

		try {
			const { data } = await axios.get<any>(`${MFAPI_BASE_URL}/${schemeCode}`);

			const meta = data.meta || {};
			const navEntries: NAVData[] = (data.data || []).map((d: any) => ({
				date: d.date,
				nav: parseFloat(d.nav),
			}));

			return {
				meta: {
					fundHouse: meta.fund_house || '',
					schemeType: meta.scheme_type || '',
					schemeCategory: meta.scheme_category || '',
					schemeCode: meta.scheme_code || schemeCode,
					schemeName: meta.scheme_name || '',
				},
				currentNAV: navEntries[0] || { date: '', nav: 0 },
				data: navEntries,
			};
		} catch (err) {
			log.error(`Failed to fetch scheme details for ${schemeCode}`, err);
			throw err;
		}
	}

	/**
	 * Get historical NAV data with optional date range filtering.
	 */
	async getSchemeHistory(options: SchemeHistoryOptions): Promise<NAVData[]> {
		const { schemeCode, startDate, endDate } = options;
		log.info(`Fetching history for scheme ${schemeCode}`);

		try {
			const { data } = await axios.get<any>(`${MFAPI_BASE_URL}/${schemeCode}`);

			let navEntries: NAVData[] = (data.data || []).map((d: any) => ({
				date: d.date,
				nav: parseFloat(d.nav),
			}));

			// mfapi.in dates are in DD-MM-YYYY format
			if (startDate || endDate) {
				navEntries = navEntries.filter((entry) => {
					const entryDate = this.parseDDMMYYYY(entry.date);
					if (!entryDate) return false;
					if (startDate && entryDate < startDate) return false;
					if (endDate && entryDate > endDate) return false;
					return true;
				});
			}

			return navEntries;
		} catch (err) {
			log.error(`Failed to fetch history for scheme ${schemeCode}`, err);
			throw err;
		}
	}

	/**
	 * Get all available mutual fund schemes (cached for 24h).
	 */
	async getAllSchemes(): Promise<MFScheme[]> {
		if (this.schemesCache && Date.now() - this.schemesCacheTime < this.CACHE_TTL) {
			return this.schemesCache;
		}

		log.info('Fetching all MF schemes');

		try {
			const { data } = await axios.get<any[]>(MFAPI_BASE_URL);

			this.schemesCache = data.map((d) => ({
				schemeCode: d.schemeCode,
				schemeName: d.schemeName,
			}));
			this.schemesCacheTime = Date.now();

			log.info(`Cached ${this.schemesCache.length} MF schemes`);
			return this.schemesCache;
		} catch (err) {
			log.error('Failed to fetch all schemes', err);
			throw err;
		}
	}

	/**
	 * Search mutual fund schemes by name.
	 */
	async searchSchemes(query: string): Promise<MFScheme[]> {
		const schemes = await this.getAllSchemes();
		const queryLower = query.toLowerCase();

		return schemes.filter((s) => s.schemeName.toLowerCase().includes(queryLower));
	}

	/**
	 * Fetch current NAV for multiple schemes at once.
	 */
	async getMultipleNAVs(schemeCodes: number[]): Promise<MultipleNAVResult[]> {
		log.info(`Fetching NAVs for ${schemeCodes.length} schemes`);

		const results = await Promise.allSettled(
			schemeCodes.map((code) => this.getSchemeNAV(code)),
		);

		return results.map((r, i) => {
			if (r.status === 'fulfilled') {
				return {
					schemeCode: r.value.schemeCode,
					schemeName: r.value.schemeName,
					nav: r.value.nav,
					date: r.value.date,
				};
			}
			return {
				schemeCode: schemeCodes[i],
				schemeName: '',
				nav: 0,
				date: '',
				error: r.reason?.message || 'Failed to fetch',
			};
		});
	}

	/**
	 * Calculate NAV change over a given number of days (1d, 7d, 30d, etc.)
	 */
	async getNAVChange(schemeCode: number, days: number): Promise<NAVChange> {
		log.info(`Calculating ${days}d NAV change for scheme ${schemeCode}`);

		try {
			const details = await this.getSchemeDetails(schemeCode);
			const navEntries = details.data;

			if (navEntries.length < 2) {
				throw new Error(`Insufficient NAV data for scheme ${schemeCode}`);
			}

			const currentEntry = navEntries[0];

			// Find the entry closest to `days` ago
			const targetDate = new Date();
			targetDate.setDate(targetDate.getDate() - days);

			let previousEntry = navEntries[navEntries.length - 1];
			for (const entry of navEntries) {
				const entryDate = this.parseDDMMYYYY(entry.date);
				if (entryDate && entryDate <= targetDate) {
					previousEntry = entry;
					break;
				}
			}

			const change = currentEntry.nav - previousEntry.nav;
			const changePercent = previousEntry.nav !== 0
				? (change / previousEntry.nav) * 100
				: 0;

			return {
				schemeCode: details.meta.schemeCode,
				schemeName: details.meta.schemeName,
				currentNAV: currentEntry.nav,
				previousNAV: previousEntry.nav,
				change: parseFloat(change.toFixed(4)),
				changePercent: parseFloat(changePercent.toFixed(2)),
				period: `${days}d`,
				currentDate: currentEntry.date,
				previousDate: previousEntry.date,
			};
		} catch (err) {
			log.error(`Failed to calculate NAV change for scheme ${schemeCode}`, err);
			throw err;
		}
	}

	/**
	 * Get NAV changes for multiple schemes over a given period.
	 * Useful for portfolio-level MF performance summary.
	 */
	async getPortfolioNAVChanges(schemeCodes: number[], days = 1): Promise<NAVChange[]> {
		log.info(`Calculating ${days}d changes for ${schemeCodes.length} schemes`);

		const results = await Promise.allSettled(
			schemeCodes.map((code) => this.getNAVChange(code, days)),
		);

		return results
			.filter((r): r is PromiseFulfilledResult<NAVChange> => r.status === 'fulfilled')
			.map((r) => r.value);
	}

	// --- Private ---

	private parseDDMMYYYY(dateStr: string): Date | null {
		// mfapi.in returns dates as "DD-MM-YYYY"
		const parts = dateStr.split('-');
		if (parts.length !== 3) return null;
		const [dd, mm, yyyy] = parts;
		return new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
	}
}

export const mfapiPlugin = new MFAPIPlugin();
