/**
 * Configuration for AMC portfolio disclosure sources.
 *
 * REALITY CHECK: AMC portfolio disclosure Excel files are NOT available
 * at stable direct-download URLs. The actual situation:
 *
 * 1. Most AMC websites show a web page with a download button (not a direct link)
 * 2. Some require JavaScript rendering to get the download link
 * 3. URLs change every month when new disclosures are published
 * 4. Some AMCs require form submission to get the file
 *
 * For production, the approach should be:
 * - Use a headless browser (Puppeteer) to navigate to the disclosure page
 * - Find and click the download link
 * - OR use a third-party data aggregator
 * - OR manually download and cache the Excel files periodically
 *
 * For now, the holdings provider supports loading from local files
 * as a fallback when URLs fail.
 */

export interface HoldingsSourceConfig {
    amc: string;
    disclosurePage: string;  // The page where download is available (not direct link)
    localPath?: string;      // Optional: path to locally downloaded file
    format: 'xlsx' | 'xls';
}

// AMC disclosure pages (for reference, NOT direct download links)
export const HOLDINGS_SOURCES: HoldingsSourceConfig[] = [
    {
        amc: 'ICICI Prudential',
        disclosurePage: 'https://www.icicipruamc.com/statutory-disclosure/portfolio-disclosure',
        format: 'xlsx',
    },
    {
        amc: 'HDFC',
        disclosurePage: 'https://www.hdfcfund.com/statutory-disclosure/portfolio-disclosure',
        format: 'xlsx',
    },
    {
        amc: 'SBI',
        disclosurePage: 'https://www.sbimf.com/en-us/information/portfolio',
        format: 'xlsx',
    },
    {
        amc: 'Axis',
        disclosurePage: 'https://www.axismf.com/statutory-disclosures/portfolio-disclosure',
        format: 'xlsx',
    },
    {
        amc: 'Kotak',
        disclosurePage: 'https://www.kotakmf.com/information/statutory-disclosures/portfolio-disclosure',
        format: 'xlsx',
    },
    {
        amc: 'Nippon India',
        disclosurePage: 'https://mf.nipponindiaim.com/investor-service/information-center-services/scheme-wise-portfolio',
        format: 'xlsx',
    },
    {
        amc: 'Tata',
        disclosurePage: 'https://www.tatamutualfund.com/statutory-disclosure/portfolio-disclosure',
        format: 'xlsx',
    },
    {
        amc: 'Mirae Asset',
        disclosurePage: 'https://www.miraeassetmf.co.in/statutory-disclosures/portfolio-disclosure',
        format: 'xlsx',
    },
    {
        amc: 'DSP',
        disclosurePage: 'https://www.dspim.com/mandatory-disclosures/portfolio-disclosure',
        format: 'xlsx',
    },
    {
        amc: 'Quant',
        disclosurePage: 'https://quantmutual.com/statutory-disclosures',
        format: 'xlsx',
    },
];
