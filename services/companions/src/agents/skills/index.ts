import fs from 'fs';
import path from 'path';

export const SKILL_NAMES = [
    'scam-awareness',
    'market-crash',
    'salary-day',
    'beginner-education',
    'debt-crisis',
    'tax-season',
    'insurance-mis-sell',
    'mutual-funds',
] as const;

export type SkillName = (typeof SKILL_NAMES)[number];

export function loadSkill(name: SkillName): string {
    const filePath = path.join(__dirname, `${name}.md`);
    return fs.readFileSync(filePath, 'utf-8');
}
