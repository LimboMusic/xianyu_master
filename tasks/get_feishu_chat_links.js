import { Browser } from "../utils/browser.js";
import { sleep } from "../utils/utils.js";
import { getMessageList, clickChatGroup, scrollChatContainer, debugMessageElements } from "../modules/feishu/feishu.js";
import { exportToExcelFile } from "../utils/file.js";
import dayjs from "dayjs";
import fs from "fs";

const loop_count = 20;

const USE_EXISTING_BROWSER = true;
const DEBUG_MODE = process.argv.includes('--debug'); // 通过命令行参数启用调试模式
const output_dir = `output/${dayjs().format("YYYY-MM-DD")}/飞书聊天链接`;
fs.mkdirSync(output_dir, { recursive: true });

const url = "https://fqacf6r7ojb.feishu.cn/next/messenger/?from=messenger_banner_login&app_id=11";

async function getFeishuChatLinks(url) {
    const browser = new Browser();
    if (USE_EXISTING_BROWSER) {
        await browser.connectToExistingBrowser();
    } else {
        await browser.launchBrowser();
    }
    await sleep(1000);
    const page = await browser.navigateWithRetry(url);

    await sleep(3000);

    if (DEBUG_MODE) {
        console.log('=== 调试模式：检查消息元素选择器 ===');
        await clickChatGroup(page);
        await sleep(2000);
        await debugMessageElements(page);
        await browser.closeBrowser();
        return [];
    }

    await clickChatGroup(page);
    await sleep(1000);
    let links = [];
    for (let i = 1; i <= loop_count; i++) {
        await scrollChatContainer(page, -800);
        links = await getMessageList(page);
        console.log(links);
        await exportToExcelFile(links.map(item => ({ '接龙信息': item })), `${output_dir}/点赞链接.xlsx`, "接龙信息");
    }
    await browser.closeBrowser();
    return links;
}

getFeishuChatLinks(url).then(() => {
    console.log('Feishu chat links task completed, exiting process...');
    process.exit(0);
}).catch((error) => {
    console.error('Task failed:', error);
    process.exit(1);
});