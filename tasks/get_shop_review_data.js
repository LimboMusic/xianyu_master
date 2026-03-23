import { chromium } from 'playwright';
import { gotoShopPage, getIntroText } from '../modules/shop_data/shop_data.js';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { exportToExcelFile } from '../utils/file.js';
import fs from 'fs';
import { Browser } from '../utils/browser.js';
import { sleep } from '../utils/utils.js';

const USE_EXISTING_BROWSER = true;


const CHORME_STARTER_NAME = "start_chrome.bat";
/** 连接本机 Chrome 前若 9222 无 CDP，则自动运行项目根目录的 start_chrome.bat（仅 Windows） */
const AUTO_START_CHROME_BAT = true;

const rsult_list = [];
const browser = new Browser();
const output_dir = `output/${dayjs().format('YYYY-MM-DD')}/店铺每日售出数据`;
fs.mkdirSync(output_dir, { recursive: true });

async function getShopData(url) {
  // 使用 navigateWithRetry 确保页面有效，如果页面已关闭会自动重新创建
  const page = await browser.navigateWithRetry(url, { maxRetries: 3 });
  await page.waitForLoadState('networkidle');
  await sleep(2000)
  const newPage = await gotoShopPage(page);
  await sleep(1000)
  const introText = await getIntroText(newPage);
  const salesMatch = introText.match(/卖出(\d+)件宝贝/);
  let salesCount = 0;
  if (salesMatch && salesMatch[1]) {
    salesCount = parseInt(salesMatch[1], 10);
  } else {
    console.log('No sales count found in introText');
  }
  const shopUrl = await newPage.url();
  // 关闭新打开的店铺页面
  if (newPage) {
    await newPage.close().catch(() => {});
  }
  // 关闭主页面并重新创建，确保下次循环可以使用
  await browser.closePage();
  await browser.openNewPage();
  return { salesCount, url: shopUrl };
}

const fileBuffer = fs.readFileSync('input/汇总_店铺.xlsx');
const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet, { header: true });

let count = 0

console.log('data', data);

if (USE_EXISTING_BROWSER) {
  await browser.connectToExistingBrowser();
} else {
  await browser.launchBrowser();
}

await ensureChromeRemoteDebugging({
  enabled: USE_EXISTING_BROWSER && AUTO_START_CHROME_BAT,
  batPath: path.resolve(CHORME_STARTER_NAME),
});
await sleep(2000);

while (count < data.length) {
  const row = data[count];
  count++;
  console.log(`Processing row ${count}`)
  const url = row['店铺网址'] || '';
  if (url) {
    let result = null;
    try {
      result = await getShopData(url);
      const obj = {
        '店铺名': row['店铺名'],
        '店铺网址': url,
        '卖出宝贝数量': result.salesCount,
        '日期': dayjs().format('YYYY/MM/DD')
      }
      console.log(obj);
      rsult_list.push(obj);
    } catch (error) {
      console.log(`Error processing row ${count}: ${error.message}`);
      // 如果页面已关闭，尝试重新创建
      try {
        await browser.closePage();
      } catch (closeError) {
        // 如果关闭失败，说明页面可能已经关闭了
      }
      // 重新创建页面，确保下次循环可以使用
      try {
        await browser.openNewPage();
      } catch (openError) {
        // 如果创建失败，尝试重新创建上下文
        console.log('Failed to open new page, recreating context...');
        await browser.recreateContext();
        await browser.openNewPage();
      }
    }

  }
  if (count % 10 === 0 && count !== 0) {
    await exportToExcelFile(rsult_list, `${output_dir}/店铺每日售出数据_${dayjs().format('YYYY-MM-DD')}.xlsx`, '店铺名');
  }
}

await exportToExcelFile(rsult_list, `${output_dir}/店铺每日售出数据_${dayjs().format('YYYY-MM-DD')}.xlsx`, '店铺名');


// 所有任务完成后结束进程
console.log('All tasks completed, exiting process...');
process.exit(0);