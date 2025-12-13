import { chromium } from 'playwright';
import { sleep } from '../utils/utils.js';
import { exportToExcelFile } from '../utils/file.js';
import dayjs from 'dayjs';
import fs from 'fs';
import * as XLSX from 'xlsx';
import { Browser } from '../utils/browser.js';
import { gotoShopPage, getReviewAndWantNumber, getLinkDescription } from '../modules/shop_data/shop_data.js';

const result_list = [];
const browser = new Browser();
const output_dir = `output/${dayjs().format('YYYY-MM-DD')}/店铺所有链接数据`;
fs.mkdirSync(output_dir, { recursive: true });

async function getShopLinks(url, shop_name) {
    try {
        await browser.launchBrowser();
        const page = await browser.navigateWithRetry(url);

        let count = await page.locator('.cardWarp--dZodM57A:not([id="selected"])').count();
        console.log('Initial count:', count);

        let processedCount = 0;
        const maxProcessedPerSession = 999999; // 限制单次处理数量，避免资源耗尽

        while (count > 0 && processedCount < maxProcessedPerSession) {
            // 检查页面是否仍然有效，如果无效则重新创建
            await browser.ensurePageValid(url);
            count = await page.locator('.cardWarp--dZodM57A:not([id="selected"])').count();
            try {
                const newPage = await gotoShopPage(page, '.cardWarp--dZodM57A:not([id="selected"])');
                if (!newPage) {
                    console.log('No more elements to process');
                    break;
                }

                const { reviewNumber, wantNumber } = await getReviewAndWantNumber(newPage);
                const description = await getLinkDescription(newPage);
                const linkUrl = await newPage.url();
                console.log('Processed:', { reviewNumber, wantNumber, linkUrl, description });
                result_list.push({ reviewNumber, wantNumber, linkUrl, description });

                // 确保新页面被正确关闭
                try {
                    await newPage.close();
                } catch (closeError) {
                    console.log(`Warning: Failed to close new page: ${closeError.message}`);
                }

                processedCount++;

                // 滚动页面以加载更多内容
                await page.evaluate(() => {
                    window.scrollBy(0, 800);
                });

                // 等待新内容加载
                await sleep(1500);

                // 重新计算剩余元素数量
                count = await page.locator('.cardWarp--dZodM57A:not([id="selected"])').count();
                console.log(`Remaining count: ${count}, Processed: ${processedCount}`);

                // 定期保存进度
                if (result_list.length > 0 && result_list.length % 5 === 0) {
                    await exportToExcelFile(result_list, `${output_dir}/${shop_name.trim()}_${dayjs().format('YYYY-MM-DD')}.xlsx`);
                }

                await sleep(800);

            } catch (error) {
                console.log(`Error processing element: ${error.message}`);

                // 如果是严重错误（如页面崩溃），等待更长时间
                if (error.message.includes('crashed') || error.message.includes('detached')) {
                    console.log('Detected page crash, waiting longer before retry...');
                    await sleep(5000);
                }

                try {
                    // 重新计算剩余元素数量
                    count = await page.locator('.cardWarp--dZodM57A:not([id="selected"])').count();
                    if (count === 0) break;
                } catch (countError) {
                    console.log(`Failed to recount elements: ${countError.message}`);
                    break; // 如果连计数都失败了，就停止
                }

                await sleep(3000);
            }
        }

        // 最终保存结果
        if (result_list.length > 0) {
            await exportToExcelFile(result_list, `${output_dir}/${shop_name.trim()}_${dayjs().format('YYYY-MM-DD')}.xlsx`);
        }

        browser.closeBrowser();
        return result_list;

    } catch (error) {
        console.log(`Error in getShopLinks: ${error.message}`);
        try {
            if (browser.browser) {
                await browser.closeBrowser();
            }
        } catch (closeError) {
            console.log(`Error closing browser: ${closeError.message}`);
        }
        return result_list; // 返回已处理的结果
    }
}

const fileBuffer = fs.readFileSync('input/汇总_店铺.xlsx');
const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet, { header: true });

console.log('data', data);

for (const row of data) {
    const url = row['店铺网址'];
    if (url) {
        await getShopLinks(url, row['店铺名']);
        await sleep(1000);
    }
}