import { inputPrompt, getResponseJson, clickDialogConfirmButton } from "../modules/kouzi/kouzi.js";
import { Browser } from "../utils/browser.js";
import { sleep } from "../utils/utils.js";
import path from "path";
import { exportToExcelFile, readExcelFile } from "../utils/file.js";
import dayjs from "dayjs";

const USE_EXISTING_BROWSER = true;
const browser = new Browser();
let result_list = [];

async function testCoZi(data) {
    if (USE_EXISTING_BROWSER) {
        await browser.connectToExistingBrowser();
    } else {
        await browser.launchBrowser();
    }
    const page = await browser.navigateWithRetry('https://www.coze.cn/task/7620134599766868250');
    let counter = 0
    try {
        for (const row of data) {
            counter++;
            console.log(`Processing row ${counter} of ${data.length}`);
            const str = row['标题'] + `图片：https://${row['图片']}` + `\n       id:${row['id']}`;
            await inputPrompt(page, str);
            await clickDialogConfirmButton(page);
            const response = await getResponseJson(page, row['id']);
            const obj = { id: response.id, '名称': response['title'], '标题': response['content'], '图片': response['img_url'], '链接': row['链接'] };
            console.log(obj);
            await sleep(3000);
            result_list.push(obj);
            await exportToExcelFile(result_list, path.resolve('output', `${dayjs().format('YYYY-MM-DD')}_cozi_result.xlsx`), 'id');
        }
    } catch (error) {
        console.log(`Error: ${error.message}`);
    } finally {
        await exportToExcelFile(result_list, path.resolve('output',`${dayjs().format('YYYY-MM-DD')}/cozi_result_${dayjs().format('YYYY-MM-DD')}.xlsx`), 'id');
    }
}

const filePath = path.resolve('input', '汇总_预置资源.xlsx');
const data = await readExcelFile(filePath);

testCoZi(data);