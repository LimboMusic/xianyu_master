import { Browser } from "../utils/browser.js";
import { sleep } from "../utils/utils.js";
import { clickChatRedPoint } from "../modules/shop_data/shop_data.js";
import { sendMessage } from "../modules/shop_data/shop_data.js";

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
  while (chatRedPointCount > 0) {
    console.log(`Chat red point count: ${chatRedPointCount}`);
    await sleep(1000);
    if (chatRedPointCount > 0) {
      await sendMessage(page, message);
      await sleep(1000);
    }
    chatRedPointCount = await clickChatRedPoint(page);
  }
  await browser.closeBrowser();
}

autoReply(url);
