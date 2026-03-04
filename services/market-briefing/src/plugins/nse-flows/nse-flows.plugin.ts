import logger from '@/utils/logger';
import { config } from '@/config/config';
import type { FIIDIIFlowData, FIIDIITrend, FlowDirection, InstitutionalFlow } from './types';

const log = logger.createServiceLogger('NSEFlowsPlugin');

const NSE_FII_API = 'https://www.nseindia.com/api/fiidiiTradeReact';

// Thresholds for flow direction classification (₹ crores)
const HEAVY_THRESHOLD = 2000;
const MODERATE_THRESHOLD = 500;

export class NSEFlowsPlugin {
	/**
	 * Get FII/DII flow trend with direction classification and narrative.
	 */
	async getFlowTrend(): Promise<FIIDIITrend> {
		const flows = await this.getDailyFlows();

		if (!flows) {
			return {
				today: null,
				direction: 'neutral',
				netFII: 0,
				netDII: 0,
				narrative: 'FII/DII data unavailable',
			};
		}

		const netFII = flows.fii.netValue;
		const netDII = flows.dii.netValue;
		const direction = this.classifyDirection(netFII);
		const narrative = this.buildNarrative(flows);

		return { today: flows, direction, netFII, netDII, narrative };
	}

	/**
	 * Fetch daily flows — tries ScraperAPI first, then Puppeteer fallback.
	 */
	async getDailyFlows(): Promise<FIIDIIFlowData | null> {
		// Try ScraperAPI first (cheaper, faster)
		if (config.scraperApi.apiKey) {
			try {
				const data = await this.fetchViaScraperAPI();
				if (data) return data;
			} catch (err: any) {
				log.warn(`ScraperAPI fetch failed: ${err.message}`);
			}
		}

		// Fallback to Puppeteer
		try {
			const data = await this.fetchViaPuppeteer();
			if (data) return data;
		} catch (err: any) {
			log.warn(`Puppeteer fetch failed: ${err.message}`);
		}

		log.error('All FII/DII fetch methods failed');
		return null;
	}

	/**
	 * Fetch via ScraperAPI proxy (bypasses NSE bot detection).
	 */
	private async fetchViaScraperAPI(): Promise<FIIDIIFlowData | null> {
		log.info('Fetching FII/DII data via ScraperAPI');

		const url = `https://api.scraperapi.com?api_key=${config.scraperApi.apiKey}&url=${encodeURIComponent(NSE_FII_API)}&render=false`;

		const response = await fetch(url, {
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(15000),
		});

		if (!response.ok) {
			throw new Error(`ScraperAPI returned ${response.status}`);
		}

		const json = await response.json();
		return this.parseNSEResponse(json, 'scraper-api');
	}

	/**
	 * Fetch via Puppeteer (visits NSE homepage for cookies, then fetches API).
	 */
	private async fetchViaPuppeteer(): Promise<FIIDIIFlowData | null> {
		log.info('Fetching FII/DII data via Puppeteer');

		const puppeteerExtra = (await import('puppeteer-extra')).default as any;
		const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;
		puppeteerExtra.use(StealthPlugin());

		const browser = await puppeteerExtra.launch({
			headless: true,
			args: ['--no-sandbox', '--disable-setuid-sandbox'],
		});

		try {
			const page = await browser.newPage();
			await page.setUserAgent(
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
			);

			// Visit NSE homepage to get cookies
			await page.goto('https://www.nseindia.com', {
				waitUntil: 'domcontentloaded',
				timeout: 20000,
			});

			// Small delay for cookies to settle
			await new Promise((r) => setTimeout(r, 2000));

			// Fetch the API endpoint with the session cookies
			const response = await page.evaluate(async (apiUrl: string) => {
				const res = await fetch(apiUrl, {
					headers: { Accept: 'application/json' },
				});
				if (!res.ok) throw new Error(`NSE API returned ${res.status}`);
				return res.json();
			}, NSE_FII_API);

			return this.parseNSEResponse(response, 'puppeteer');
		} finally {
			await browser.close();
		}
	}

	/**
	 * Parse NSE FII/DII API response.
	 * NSE returns an array of objects with category, buyValue, sellValue, netValue.
	 */
	private parseNSEResponse(data: any, source: FIIDIIFlowData['source']): FIIDIIFlowData | null {
		if (!data || !Array.isArray(data)) {
			log.warn('NSE response is not an array');
			return null;
		}

		const fiiRow = data.find(
			(row: any) => row.category === 'FII/FPI' || row.category === 'FPI',
		);
		const diiRow = data.find((row: any) => row.category === 'DII');

		if (!fiiRow || !diiRow) {
			log.warn(`Missing FII or DII row in NSE response (found categories: ${data.map((r: any) => r.category).join(', ')})`);
			return null;
		}

		const parseValue = (val: any): number => {
			if (typeof val === 'number') return val;
			if (typeof val === 'string') return parseFloat(val.replace(/,/g, '')) || 0;
			return 0;
		};

		const fii: InstitutionalFlow = {
			buyValue: parseValue(fiiRow.buyValue),
			sellValue: parseValue(fiiRow.sellValue),
			netValue: parseValue(fiiRow.netValue),
		};

		const dii: InstitutionalFlow = {
			buyValue: parseValue(diiRow.buyValue),
			sellValue: parseValue(diiRow.sellValue),
			netValue: parseValue(diiRow.netValue),
		};

		const date = fiiRow.date || new Date().toISOString().split('T')[0];

		log.info(`FII/DII parsed: FII net=${fii.netValue.toFixed(0)} Cr, DII net=${dii.netValue.toFixed(0)} Cr (${source})`);

		return { date, fii, dii, fetchedAt: new Date(), source };
	}

	private classifyDirection(netFII: number): FlowDirection {
		const abs = Math.abs(netFII);
		if (netFII > 0 && abs >= HEAVY_THRESHOLD) return 'heavy-buying';
		if (netFII > 0 && abs >= MODERATE_THRESHOLD) return 'buying';
		if (netFII < 0 && abs >= HEAVY_THRESHOLD) return 'heavy-selling';
		if (netFII < 0 && abs >= MODERATE_THRESHOLD) return 'selling';
		return 'neutral';
	}

	private buildNarrative(flows: FIIDIIFlowData): string {
		const fmtCr = (val: number): string => {
			const abs = Math.abs(val);
			return `₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr`;
		};

		const fiiAction = flows.fii.netValue >= 0 ? 'bought' : 'sold';
		const diiAction = flows.dii.netValue >= 0 ? 'bought' : 'sold';

		return `FII ${fiiAction} ${fmtCr(flows.fii.netValue)} | DII ${diiAction} ${fmtCr(flows.dii.netValue)}`;
	}
}

export const nseFlowsPlugin = new NSEFlowsPlugin();
