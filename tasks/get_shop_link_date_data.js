import dayjs from "dayjs";
import fs from "fs";
import { Browser } from "../utils/browser.js";
import { getReviewAndWantNumber, getImageUrls } from '../modules/shop_data/shop_data.js'
import { readExcelFile, exportToExcelFile } from '../utils/file.js'
import { sleep } from '../utils/utils.js'
import path from 'path'

const USE_EXISTING_BROWSER = true;

const output_dir = `output/${dayjs().format("YYYY-MM-DD")}/链接每日数据`;
fs.mkdirSync(output_dir, { recursive: true });

const browser = new Browser();

const data = await readExcelFile(path.resolve("input", "链接每日数据.xlsx"));

console.log(`读取到 ${data.length} 条链接数据`);

if (data.length === 0) {
    console.error('错误：Excel 文件中没有数据！');
    process.exit(1);
}

const result = []

if (USE_EXISTING_BROWSER) {
    await browser.connectToExistingBrowser();
} else {
    await browser.launchBrowser();
}

async function getLinkDateData() {
    try {
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const url = row['链接'];

            if (!url) {
                console.warn(`第 ${i + 1} 行没有链接，跳过`);
                result.push(row); // 保留原始数据
                continue;
            }

            try {
                console.log(`正在处理第 ${i + 1}/${data.length} 条链接: ${url}`);
                const page = await browser.navigateWithRetry(url);
                await sleep(2000);
                const { reviewNumber, wantNumber } = await getReviewAndWantNumber(page);
                const imgUrl = await getImageUrls(page, false)
                const date = dayjs().format('YYYY/MM/DD');
                const obj = {
                    ...row,
                    '图片': imgUrl
                };
                obj[`售出${date}`] = wantNumber;
                obj[`浏览${date}`] = reviewNumber;
                console.log(`已处理 ${i + 1} 条链接，浏览: ${reviewNumber}, 售出: ${wantNumber}`);
                result.push(obj);
            } catch (error) {
                console.error(`处理第 ${i + 1} 条链接时出错: ${error.message}`);
                // 即使出错也保留原始数据
                result.push(row);
            }
        }
    } catch (error) {
        console.error(`处理数据时发生错误: ${error.message}`);
        throw error;
    }
}

try {
    await getLinkDateData();

    // 保存结果到 Excel 文件
    const outputFile = path.join(output_dir, `链接每日数据_${dayjs().format("YYYY-MM-DD")}2.xlsx`);
    await exportToExcelFile(result, outputFile);
    console.log(`结果已保存到: ${outputFile}`);

    console.log('All tasks completed, exiting process...');
    process.exit(0);
} catch (error) {
    console.error('程序执行失败:', error);
    process.exit(1);
}


