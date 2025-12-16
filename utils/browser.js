import { chromium } from 'playwright';

export class Browser {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
    }

    async launchBrowser() {
        this.browser = await chromium.launch({ headless: false });
        this.context = await this.browser.newContext();
        this.page = await this.context.newPage();
    }

    async connectToExistingBrowser(port = 9222) {
        try {
            // 先尝试 IPv4 地址，Windows 上更稳定
            let wsEndpoint;
            try {
                this.browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
            } catch (ipv4Error) {
                // 如果 IPv4 失败，尝试 IPv6/localhost
                console.log('IPv4 连接失败，尝试 localhost...');
                this.browser = await chromium.connectOverCDP(`http://localhost:${port}`);
            }
            const contexts = this.browser.contexts();
            if (contexts.length > 0) {
                this.context = contexts[0];
                const pages = this.context.pages();
                if (pages.length > 0) {
                    this.page = pages[0]; // 使用第一个已有的页面
                } else {
                    this.page = await this.context.newPage();
                }
            } else {
                this.context = this.browser.contexts()[0] || await this.browser.newContext();
                this.page = await this.context.newPage();
            }
            console.log('成功连接到现有浏览器');
        } catch (error) {
            console.error(`连接到现有浏览器失败: ${error.message}`);
            console.log('将启动新浏览器...');
            await this.launchBrowser();
        }
    }

    async openNewPage() {
        this.page = await this.context.newPage();
    }

    async closePage() {
        await this.page.close();
    }

    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    async recreateContext() {
        if (this.context) {
            try {
                await this.context.close();
            } catch (e) {
                // Ignore errors when closing context
            }
        }
        this.context = await this.browser.newContext();
        return this.context;
    }

    async recreateBrowser() {
        if (this.browser) {
            try {
                await this.browser.close();
            } catch (e) {
                // Ignore errors when closing browser
            }
        }
        this.browser = await chromium.launch({ headless: false });
        this.context = await this.browser.newContext();
        return this.browser;
    }

    async navigateWithRetry(url, options = {}) {
        const { sleep } = await import('../utils/utils.js');
        const maxRetries = options.maxRetries || 30;
        let retryCount = 0;

        while (retryCount < maxRetries) {
            try {
                // 检查页面和上下文是否仍然有效
                try {
                    await this.page.evaluate(() => document.readyState);
                } catch (pageError) {
                    console.log(`Page is invalid, checking browser context...`);
                    try {
                        // 先检查上下文是否有效
                        const testPage = await this.context.newPage();
                        await testPage.close();
                        // 如果能创建页面说明上下文有效，重新创建主页面
                        console.log(`Context is valid, recreating page...`);
                        this.page = await this.context.newPage();
                    } catch (contextError) {
                        console.log(`Browser context is also invalid, recreating context and page...`);
                        // 重新创建整个上下文和页面
                        await this.recreateContext();
                        this.page = await this.context.newPage();
                    }
                }

                await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await this.page.waitForLoadState('networkidle', { timeout: 30000 });
                return this.page; // 成功导航，返回页面
            } catch (error) {
                retryCount++;
                console.log(`Navigation attempt ${retryCount} failed: ${error.message}`);

                // 如果是浏览器关闭相关的错误，重新创建整个浏览器环境
                if (error.message.includes('closed') || error.message.includes('detached') || error.message.includes('crashed')) {
                    try {
                        console.log('Browser context may be closed, recreating browser environment...');
                        await this.recreateContext();
                        this.page = await this.context.newPage();
                    } catch (recreateError) {
                        console.log(`Failed to recreate browser environment: ${recreateError.message}`);
                        // 如果连浏览器都失效了，可能需要重新启动整个浏览器
                        try {
                            console.log('Attempting to restart browser...');
                            await this.recreateBrowser();
                            this.page = await this.context.newPage();
                        } catch (browserError) {
                            console.log(`Failed to restart browser: ${browserError.message}`);
                        }
                    }
                }

                if (retryCount >= maxRetries) {
                    throw new Error(`Failed to navigate to ${url} after ${maxRetries} attempts: ${error.message}`);
                }
                await sleep(2000); // 等待2秒后重试
            }
        }
    }

    async ensurePageValid(url) {
        const { sleep } = await import('../utils/utils.js');

        try {
            await this.page.evaluate(() => document.readyState);
        } catch (pageError) {
            console.log(`Page is no longer valid: ${pageError.message}`);
            // 尝试重新创建页面和上下文
            try {
                console.log('Attempting to recreate page and context...');
                try {
                    // 先尝试创建页面
                    this.page = await this.context.newPage();
                } catch (contextError) {
                    console.log(`Context is invalid, recreating context...`);
                    // 如果上下文无效，重新创建上下文和页面
                    await this.recreateContext();
                    this.page = await this.context.newPage();
                }

                await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await this.page.waitForLoadState('networkidle', { timeout: 30000 });
                // 重新计算元素数量
                console.log(`Page recreated successfully. New count: ${count}`);
            } catch (recreateError) {
                console.log(`Failed to recreate page: ${recreateError.message}`);
                throw recreateError;
            }
        }
        return null; // 页面仍然有效
    }
}