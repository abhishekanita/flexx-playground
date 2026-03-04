import { config } from '@/config';
import { ServiceLogger } from '@/utils/logger';
import { sleep } from '@/utils/sleept';
import { Browser, Page } from 'puppeteer';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { FormStep } from './configs';

export interface BrowserClientConfig {
    headless?: boolean;
    proxy?: boolean;
    viewport?: { width: number; height: number };
    navigationTimeout?: number;
    pageSettleDelay?: number;
    captchaDelay?: number;
}

const DEFAULT_CONFIG: Required<BrowserClientConfig> = {
    headless: false,
    proxy: true,
    viewport: { width: 1920, height: 1080 },
    navigationTimeout: 120_000,
    pageSettleDelay: 4000,
    captchaDelay: 2500,
};

export class BrowserClient {
    log: ServiceLogger;
    browser: Browser = null;
    page: Page = null;
    proxySessionId: string;
    config: Required<BrowserClientConfig>;
    static readonly RECAPTCHA_SITE_KEY = '6LeFNqcpAAAAAClHOnC8qbwSUtY9NFFDxYrMraWF';

    constructor(browserConfig?: BrowserClientConfig) {
        this.log = logger.createServiceLogger('BrowserClient');
        this.config = { ...DEFAULT_CONFIG, ...browserConfig };
        this.proxySessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        this.log.info(`Session: ${this.proxySessionId} | headless: ${this.config.headless} | proxy: ${this.config.proxy}`);
    }

    async init(pageUrl: string): Promise<void> {
        puppeteerExtra.use(StealthPlugin());
        const { host, port, username, password } = config.dataimpulse;
        const useProxy = this.config.proxy && !!(host && username);
        const stickyUser = useProxy ? `${username};sessid.${this.proxySessionId}` : '';
        const launchArgs = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            `--window-size=${this.config.viewport.width},${this.config.viewport.height}`,
            '--start-maximized',
        ];
        if (useProxy) {
            launchArgs.push(`--proxy-server=http://${host}:${port}`);
            launchArgs.push('--proxy-bypass-list=*.google.com;*.gstatic.com;*.googleapis.com');
            launchArgs.push('--ignore-certificate-errors');
            this.log.info(`Proxy: ${host}:${port} (session: ${this.proxySessionId})`);
        }
        this.log.info('Launching browser...');
        this.browser = await puppeteerExtra.launch({
            headless: this.config.headless,
            args: launchArgs,
        });
        this.page = await this.browser.newPage();

        if (useProxy) {
            await this.page.authenticate({ username: stickyUser, password });
        }
        await this.page.setViewport(this.config.viewport);
        await this.navigate(pageUrl);
        await new Promise(r => setTimeout(r, this.config.pageSettleDelay));
    }

    async navigate(pageName: string): Promise<void> {
        if (!this.page) throw new Error('Browser not initialized. Call init() first.');
        this.log.info(`Navigating to ${pageName}...`);
        await this.page.goto(`${pageName}`, {
            waitUntil: 'domcontentloaded',
            timeout: this.config.navigationTimeout,
        });
        this.log.info('Page loaded');
        await new Promise(r => setTimeout(r, this.config.pageSettleDelay));
    }

    async fillForm(
        page: any,
        params: {
            email: string;
            from_date: Date;
            to_date: Date;
        },
        steps: FormStep[],
        selectors: Record<string, string>
    ): Promise<void> {
        for (const step of steps) {
            switch (step.type) {
                case 'radio': {
                    await this.clickRadioButton(step.label);
                    await sleep(300 + Math.random() * 500);
                    break;
                }
                case 'input': {
                    const value = (params as any)[step.param] ?? step.default;
                    if (!value && step.optional) break;
                    if (!value) break;
                    const sel = selectors[step.selector];
                    if (!sel) break;
                    await this.typeIntoField(sel, String(value));
                    await sleep(300 + Math.random() * 500);
                    break;
                }
                case 'date': {
                    const dateVal = (params as any)[step.param] as Date | undefined;
                    if (!dateVal) break;
                    const sel = selectors[step.selector];
                    if (!sel) break;
                    await this.setDateField(sel, dateVal);
                    await sleep(300 + Math.random() * 500);
                    break;
                }
                case 'checkbox': {
                    const sel = selectors[step.selector];
                    if (!sel) break;
                    await this.checkCheckbox(sel);
                    await sleep(200);
                    break;
                }
                case 'mat-select': {
                    const sel = selectors[step.selector];
                    if (!sel) break;
                    await this.selectMatOption(sel, step.option);
                    await sleep(300 + Math.random() * 500);
                    break;
                }
                case 'mat-select-multi': {
                    const sel = selectors[step.selector];
                    if (!sel) break;
                    for (const opt of step.options) {
                        await this.selectMatOption(sel, opt);
                        await sleep(200);
                    }
                    // Close the dropdown by clicking elsewhere
                    await page.click('body');
                    await sleep(200);
                    break;
                }
            }
        }
        this.log.info('Form filled successfully');
    }

    async waitForFormReady(selectors: string[]): Promise<void> {
        this.log.info('Waiting for form to be ready...');
        for (const selector of selectors) {
            this.log.info(`  Waiting for: ${selector}`);
            await this.page.waitForSelector(selector, { timeout: 15_000 });
        }
        const fields = await this.page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input, mat-radio-button, mat-checkbox, mat-select'));
            return inputs.map((el: any) => ({
                tag: el.tagName.toLowerCase(),
                formControlName: el.getAttribute('formcontrolname'),
                type: el.getAttribute('type'),
                placeholder: el.getAttribute('placeholder'),
                id: el.id,
            }));
        });
        this.log.info(`Form fields found: ${JSON.stringify(fields, null, 2)}`);
        this.log.info('Form is ready');
    }

    async typeIntoField(selector: string, value: string): Promise<void> {
        this.log.info(`Typing into ${selector} (${value.length} chars)`);
        await this.page.waitForSelector(selector, { timeout: 10_000 });

        await this.page.focus(selector);
        await sleep(100);

        await this.page.click(selector, { clickCount: 3 });
        await sleep(50);
        await this.page.keyboard.press('Backspace');
        await sleep(100);

        await this.page.$eval(selector, (el: any) => {
            el.value = '';
            el.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await sleep(50);

        await this.page.focus(selector);
        await sleep(50);

        for (const char of value) {
            await this.page.keyboard.type(char, { delay: 0 });
            await sleep(40 + Math.random() * 80);
        }

        await this.page.$eval(selector, (el: any) => {
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
        });

        const actualValue = await this.page.$eval(selector, (el: any) => el.value);
        this.log.info(`  → Field value after typing: "${actualValue}"`);
    }

    async clickRadioButton(label: string): Promise<void> {
        this.log.info(`Clicking radio button: "${label}"`);
        const clicked = await this.page.evaluate((labelText: string) => {
            const radios = Array.from(document.querySelectorAll('mat-radio-button'));
            for (let i = 0; i < radios.length; i++) {
                const radio = radios[i];
                if (radio.textContent?.trim().toLowerCase().includes(labelText.toLowerCase())) {
                    const inner =
                        radio.querySelector('.mat-radio-container') ||
                        radio.querySelector('.mdc-radio') ||
                        radio.querySelector('input[type="radio"]') ||
                        radio;
                    (inner as HTMLElement).click();
                    return true;
                }
            }
            return false;
        }, label);

        if (!clicked) {
            this.log.warn(`Radio button "${label}" not found, trying label click...`);
            await this.page.evaluate((labelText: string) => {
                const labels = Array.from(document.querySelectorAll('label'));
                for (let i = 0; i < labels.length; i++) {
                    if (labels[i].textContent?.trim().toLowerCase().includes(labelText.toLowerCase())) {
                        labels[i].click();
                        return;
                    }
                }
            }, label);
        }
    }

    async setDateField(selector: string, date: Date): Promise<void> {
        const formatted = this.formatDate(date);
        this.log.info(`Setting date field ${selector} to ${formatted}`);
        await this.page.waitForSelector(selector, { timeout: 10_000 });

        await this.page.$eval(
            selector,
            (el: any, value: string) => {
                const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
                if (nativeSetter) {
                    nativeSetter.call(el, value);
                } else {
                    el.value = value;
                }
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('blur', { bubbles: true }));
            },
            formatted
        );

        const actual = await this.page.$eval(selector, (el: any) => el.value);
        this.log.info(`  → Date field value: "${actual}"`);
        await sleep(200);
    }

    async checkCheckbox(selector: string): Promise<void> {
        this.log.info(`Checking checkbox: ${selector}`);
        const exists = await this.page.$(selector);
        if (!exists) {
            this.log.warn(`Checkbox ${selector} not found, skipping`);
            return;
        }

        const isChecked = await this.page.evaluate((sel: string) => {
            const el = document.querySelector(sel) as HTMLInputElement;
            return el?.checked ?? false;
        }, selector);

        if (!isChecked) {
            await this.page.evaluate((sel: string) => {
                const input = document.querySelector(sel);
                const matCheckbox = input?.closest('mat-checkbox');
                if (matCheckbox) {
                    const clickTarget =
                        matCheckbox.querySelector('.mat-checkbox-inner-container') ||
                        matCheckbox.querySelector('.mdc-checkbox') ||
                        matCheckbox;
                    (clickTarget as HTMLElement).click();
                } else if (input) {
                    (input as HTMLElement).click();
                }
            }, selector);
        }
    }

    async selectMatOption(selector: string, optionText: string): Promise<void> {
        this.log.info(`Selecting mat-option "${optionText}" in ${selector}`);
        await this.page.waitForSelector(selector, { timeout: 10_000 });
        await this.page.click(selector);
        await sleep(500);

        // Wait for the overlay panel to appear
        await this.page.waitForSelector('.mat-select-panel, .mat-mdc-select-panel, .cdk-overlay-pane mat-option', { timeout: 5_000 });
        await sleep(200);

        const clicked = await this.page.evaluate((text: string) => {
            const options = Array.from(document.querySelectorAll('mat-option'));
            for (const opt of options) {
                if (opt.textContent?.trim().toLowerCase().includes(text.toLowerCase())) {
                    (opt as HTMLElement).click();
                    return true;
                }
            }
            return false;
        }, optionText);

        if (!clicked) {
            this.log.warn(`Mat-option "${optionText}" not found`);
        }
    }

    async resetProxy(): Promise<void> {
        await this.close();
        this.proxySessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        this.log.info(`Proxy reset — new session: ${this.proxySessionId}`);
    }

    /** Close the browser */
    async close(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
            this.log.info('Browser closed');
        }
    }

    private formatDate(d: Date): string {
        const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const day = String(d.getDate()).padStart(2, '0');
        const mon = MONTHS[d.getMonth()];
        const year = d.getFullYear();
        return `${day}-${mon}-${year}`;
    }
}
