/**
 * Fund name abbreviation utility — shared across dashboard-data and standalone modules.
 */

export function abbreviateFundName(name: string): string {
    return name
        .replace(/- (Regular|Direct) (Plan|Growth|Option)?/gi, '')
        .replace(/\((?:Demat|Non-Demat|Regular|Direct|Growth)\)/gi, '')
        .replace(/Fund/gi, '')
        .replace(/Tax Saver/gi, 'TS')
        .replace(/ELSS/gi, 'ELSS')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 18)
        .trim();
}
