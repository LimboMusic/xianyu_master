import { chromium } from 'playwright';
import { sleep } from '../utils/utils.js';
import { exportToExcelFile } from '../utils/file.js';
import dayjs from 'dayjs';
import fs from 'fs';
import { Browser } from '../utils/browser.js';
import { gotoShopPage, getReviewAndWantNumber, getLinkDescription, getImageUrls, getUserName, gotoNextPage, extractItemId } from '../modules/shop_data/shop_data.js';

const result_list = [];
const browser = new Browser();
const output_dir = `output/${dayjs().format('YYYY-MM-DD')}/关键词数据`;
fs.mkdirSync(output_dir, { recursive: true });

async function getShopLinks(url, keyword) {
    try {
        await browser.launchBrowser();
        let count = 0;
        let page
        let retryCount = 0;
        while (count == 0 && retryCount < 10) {
            page = await browser.navigateWithRetry(url);
            count = await page.locator('.feeds-item-wrap--rGdH_KoF:not([id="selected"])').count();
            console.log('Initial count:', count);
            await sleep(1000);
            retryCount++;
        }


        let processedCount = 0;
        const maxProcessedPerSession = 999999; // 限制单次处理数量，避免资源耗尽
        await browser.ensurePageValid(url);

        while (count > 1 && processedCount < maxProcessedPerSession) {

            // 检查页面是否仍然有效，如果无效则重新创建
            await browser.ensurePageValid(url);
            count = await page.locator('.feeds-item-wrap--rGdH_KoF:not([id="selected"])').count();
            try {
                const newPage = await gotoShopPage(page, '.feeds-item-wrap--rGdH_KoF:not([id="selected"])');

                if (newPage === 'error page') {
                    console.log('Error page, waiting 3 seconds and continue');
                    await sleep(3000);
                    continue;
                }
                if (!newPage) {
                    console.log('No more elements to process');
                    break;
                }

                const { reviewNumber, wantNumber } = await getReviewAndWantNumber(newPage);
                const description = await getLinkDescription(newPage);
                const imageUrls = await getImageUrls(newPage);
                const userName = await getUserName(newPage);
                const linkUrl = await newPage.url();
                const id = await extractItemId(linkUrl || '');
                const obj = { id, "浏览量": reviewNumber, "想要人数": wantNumber, "链接": linkUrl, "名称": description.slice(0, 10), "标题": description, "图片": imageUrls, "用户名": userName };
                console.log('Processed:', obj);
                result_list.push(obj);

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
                count = await page.locator('.feeds-item-wrap--rGdH_KoF:not([id="selected"])').count();
                console.log(`Remaining count: ${count}, Processed: ${processedCount}`);

                // 定期保存进度
                if (result_list.length > 0 && result_list.length % 5 === 0) {
                    await exportToExcelFile(result_list, `${output_dir}/${keyword.trim()}_${dayjs().format('YYYY-MM-DD')}.xlsx`);
                }

                if (count <= 2) {
                    await gotoNextPage(page);
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
            await exportToExcelFile(result_list, `${output_dir}/${keyword.trim()}_${dayjs().format('YYYY-MM-DD')}.xlsx`, id);
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

await getShopLinks('https://www.goofish.com/search?q=ppt模板&spm=a21ybx.search.searchInput.0', 'ppt模板');
