import { Browser } from "../utils/browser.js";
import { sleep } from "../utils/utils.js";
import { getMessageListLength, scrollDownMessageList, clickChatRedPoint, getChatHeadText, sendMessage } from "../modules/chat_page/chat_page.js";

const url =
    "https://www.goofish.com/im?spm=a21ybx.home.sidebar.2.4c053da6TfOP2U";
const message = "来啦";
const USE_EXISTING_BROWSER = true;

async function autoReply(url) {
    const browser = new Browser();
    if (USE_EXISTING_BROWSER) {
        await browser.connectToExistingBrowser();
    } else {
        await browser.launchBrowser();
    }
    await sleep(1000);
    const page = await browser.navigateWithRetry(url);
    let chatRedPointCount = await clickChatRedPoint(page);
    while (chatRedPointCount > 0 || await getMessageListLength(page) > 0) {
        await sleep(2000);
        const chatHeadText = await getChatHeadText(page);
        console.log(`Chat head text: ${chatHeadText}`);
        console.log(`Chat red point count: ${chatRedPointCount}`);
        await sleep(1000);
        if (chatRedPointCount > 0 && chatHeadText.length > 0) {
            if (!/直接买|去评价|交易中|去购买|立即购买|提醒发货|确认收货/.test(chatHeadText)) {
                await sendMessage(page, message);
                await sleep(1000);
            }
        }
        await sleep(1000);
        chatRedPointCount = await clickChatRedPoint(page);
        if (chatRedPointCount === 0 && await getMessageListLength(page) > 0) {
            await scrollDownMessageList(page, 1000);
            await sleep(1000);
        }
    }
    await browser.closeBrowser();
}

autoReply(url);
