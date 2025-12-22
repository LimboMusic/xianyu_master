import { chromium } from 'playwright';
import { gotoShopPage, getIntroText } from '../modules/shop_data/shop_data.js';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { exportToExcelFile } from '../utils/file.js';
import fs from 'fs';
import { Browser } from '../utils/browser.js';
import { sleep } from '../utils/utils.js';

const rsult_list = [];
const browser = new Browser();
const output_dir = `output/${dayjs().format('YYYY-MM-DD')}/店铺每日售出数据`;
fs.mkdirSync(output_dir, { recursive: true });

async function getShopData(url) {
  await browser.launchBrowser();
  const page = browser.page;
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  await sleep(1000)
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
  await browser.closeBrowser();
  return { salesCount, url: shopUrl };
}

const fileBuffer = fs.readFileSync('input/汇总_店铺.xlsx');
const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet, { header: true });

let count = 0

console.log('data', data);



for (const row of data) {
  count++;
  console.log(`Processing row ${count}`)
  const url = row['店铺网址'];
  if (url) {
    const result = await getShopData(url);
    const obj = {
      '店铺名': row['店铺名'],
      '店铺网址': url,
      '卖出宝贝数量': result.salesCount,
      '日期': dayjs().format('YYYY/MM/DD')
    }
    console.log(obj);
    rsult_list.push(obj);
  }
  if (count % 10 === 0 && count !== 0) {
    await exportToExcelFile(rsult_list, `${output_dir}/店铺每日售出数据_${dayjs().format('YYYY-MM-DD')}.xlsx`,'店铺名');
  }
}

await exportToExcelFile(rsult_list, `${output_dir}/店铺每日数据_${dayjs().format('YYYY-MM-DD')}.xlsx`,'店铺名');