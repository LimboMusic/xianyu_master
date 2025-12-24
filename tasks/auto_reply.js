import { Browser } from "../utils/browser.js";
import { sleep } from "../utils/utils.js";
import { clickChatRedPoint } from "../modules/shop_data/shop_data.js";

const url = 'https://m.tb.cn/h.7VTdkIF?tk=WNzsfxauWsv';

async function autoReply(url) {
    const browser = new Browser();
    await browser.launchBrowser();
    const page = await browser.page;
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    await sleep(1000);
    let chatRedPointCount = 0;
    while (chatRedPointCount === 0) {
        chatRedPointCount = await clickChatRedPoint(page);
        await sleep(1000);
        if (chatRedPointCount > 0) {
            await sendMessage(page, '来啦');
            await sleep(1000);
        }
    }
    await browser.closeBrowser();
}

autoReply(url)