import { MFStatementCategory } from '@/types/statements';
import z from 'zod';

export const INITIAL_PAGE = 'https://www.camsonline.com/Investors/Statements/Consolidated-Account-Statement';
export const DEFAULT_PASSWORD = '12345678@';
export const DEFAULT_AMC_CODES = 'IF,B,AO,G,CHS,D,FTI,H,HLS,O,P,JIO,K,MM,PLF,PP,L,SH,T,TMF,UFI,UK,Y,Z';

export const DIALOG_HANDLERS: {
    name: string;
    detect: string;
    actions: {
        type: 'click';
        selector: string;
    }[];
    waitForHidden?: string;
    maxAttempts?: number;
}[] = [
    {
        name: 'disclaimer',
        detect: 'mat-dialog-container app-camsterms',
        actions: [
            { type: 'click', selector: 'mat-radio-button[value="ACCEPT"]' },
            { type: 'click', selector: 'app-camsterms input[value="PROCEED"]' },
        ],
        waitForHidden: 'mat-dialog-container app-camsterms',
    },
    {
        name: 'generic-popup',
        detect: 'mat-dialog-container',
        actions: [
            { type: 'click', selector: 'mat-dialog-container mat-icon.close-popup' },
            { type: 'click', selector: 'mat-dialog-container .close-icon' },
            { type: 'click', selector: '.cdk-overlay-backdrop' },
        ],
        maxAttempts: 3,
    },
];

export type FormStep =
    | { type: 'radio'; label: string; group: string }
    | { type: 'input'; selector: string; param: string; default?: string; optional?: boolean }
    | { type: 'date'; selector: string; param: string }
    | { type: 'checkbox'; selector: string }
    | { type: 'mat-select'; selector: string; option: string }
    | { type: 'mat-select-multi'; selector: string; options: string[] };

export interface StatementCategoryConfig {
    category: MFStatementCategory;
    pageName: string;
    form: {
        url: string;
        selectors: Record<string, string>;
        submitButton: string;
    };
    formSteps: FormStep[];
}

export const STATEMENT_CONFIG: Partial<Record<MFStatementCategory, StatementCategoryConfig>> = {
    [MFStatementCategory.ConsolidatedDetailedStatement]: {
        category: MFStatementCategory.ConsolidatedDetailedStatement,
        pageName: '/Investors/Statements/Consolidated-Account-Statement',
        form: {
            url: '/Investors/Statements/Consolidated-Account-Statement',
            selectors: {
                email: 'input[formcontrolname="email_id"]',
                password: 'input[formcontrolname="password"]',
                confirmPassword: 'input[formcontrolname="confirmPassword"]',
                pan: 'input[formcontrolname="pan"]',
                from_date: 'input[formcontrolname="from_date"]',
                to_date: 'input[formcontrolname="to_date"]',
                zeroBalFolio: 'input[formcontrolname="zero_bal_folio"]',
            },
            submitButton: 'button[type="submit"]',
        },
        formSteps: [
            { type: 'radio', label: 'Detailed', group: 'statemttype' },
            { type: 'radio', label: 'Specific Period', group: 'request_flag' },
            { type: 'input', selector: 'email', param: 'email' },
            { type: 'input', selector: 'password', param: 'password', default: DEFAULT_PASSWORD },
            { type: 'input', selector: 'confirmPassword', param: 'password', default: DEFAULT_PASSWORD },
            { type: 'input', selector: 'pan', param: 'pan', optional: true },
            { type: 'date', selector: 'from_date', param: 'from_date' },
            { type: 'date', selector: 'to_date', param: 'to_date' },
            { type: 'radio', label: 'Yes', group: 'zero_bal_folio' },
        ],
    },
};

export const getStatementConfig = (category: MFStatementCategory): StatementCategoryConfig => {
    const cfg = STATEMENT_CONFIG[category];
    if (!cfg) throw new Error(`No config for category: ${category}`);
    return cfg;
};
