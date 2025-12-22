import { Browser } from "../utils/browser.js";
import { goToChatPage, sendMessage } from "../modules/shop_data/shop_data.js";
import { sleep } from "../utils/utils.js";
import { extractLikeLinks } from "../utils/extract_like_links.js";


const USE_EXISTING_BROWSER = true;

async function autoChatLink(links, intervalMs = 3000) {
  const linkList = Array.isArray(links) ? links : [links];

  const browser = new Browser();
  if (USE_EXISTING_BROWSER) {
    await browser.connectToExistingBrowser();
  } else {
    await browser.launchBrowser();
  }

  for (const link of linkList) {
    console.log(`Start processing link: ${link}`);

    let page = null;
    try {
      // 限制重试次数，避免长时间卡在一个链接上
      page = await browser.navigateWithRetry(link, { maxRetries: 3 });
    } catch (error) {
      console.log(`Failed to navigate to link, skip and go next. Link: ${link}`);
      console.log(`Error: ${error.message}`);
      continue; // 跳过当前链接，继续下一个
    }

    if (!page) {
      console.log(`Page is null for link: ${link}, skip.`);
      continue;
    }

    let chatPage = null;
    try {
      chatPage = await goToChatPage(page);
    } catch (error) {
      console.log(`Failed to go to chat page for link: ${link}`);
      console.log(`Error: ${error.message}`);
    }

    if (!chatPage) {
      console.log(`Chat page not opened for link: ${link}, skip sending message.`);
      continue;
    }

    await sleep(intervalMs);

    try {
      await sendMessage(chatPage);
    } catch (error) {
      console.log(`Failed to send message for link: ${link}`);
      console.log(`Error: ${error.message}`);
    }

    try {
      await chatPage.close();
    } catch (e) {}

    try {
      await browser.closePage();
    } catch (e) {}

    await sleep(intervalMs);
  }
}

// 第一个参数可以是单个链接字符串，也可以是链接数组
// 第二个参数 times 控制重复发送次数，第三个参数是每次发送间隔（毫秒）
// await autoChatLink(
//   [
//     "https://m.tb.cn/h.7VTdkIF?tk=WNzsfxauWsv",
//     "https://m.tb.cn/h.7VToJZT?tk=bG8TfxZfd1w",
//   ],
//   3000
// );


const res = await extractLikeLinks();
const links = res.map(item => item.linkUrl);
await autoChatLink(links, 3000);