import { Tool } from 'ai';
import z from 'zod';
import { SKILL_NAMES, loadSkill, SkillName } from '../skills';

export const loadSkillTool: Tool = {
    description:
        'Load a situational skill to get specialized knowledge for handling specific financial scenarios. ' +
        'Use this when the conversation enters a specific domain that needs deeper context. ' +
        'Available skills: ' +
        'scam-awareness (OTP phishing, fake UPI, loan app harassment), ' +
        'market-crash (anti-panic framework, SIP advantage during dips), ' +
        'salary-day (pay-yourself-first protocol, allocation framework), ' +
        'beginner-education (5-step path from zero to investing), ' +
        'debt-crisis (FOIR triage, avalanche vs snowball, payday loan spiral), ' +
        'tax-season (80C optimization, new vs old regime), ' +
        'insurance-mis-sell (ULIP/endowment IRR calculation, surrender decision tree).',
    inputSchema: z.object({
        skillName: z
            .enum(SKILL_NAMES)
            .describe('The skill to load'),
    }),
    execute: async ({ skillName }: { skillName: SkillName }) => {
        const content = loadSkill(skillName);
        return {
            skill: skillName,
            content,
        };
    },
};
