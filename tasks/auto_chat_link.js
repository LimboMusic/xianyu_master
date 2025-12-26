import { Browser } from "../utils/browser.js";
import { goToChatPage, sendMessage } from "../modules/shop_data/shop_data.js";
import { sleep } from "../utils/utils.js";
import { extractLikeLinks } from "../utils/extract_like_links.js";
import { updateExcelCell } from "../utils/file.js";
import path from "path";
import { getMessageListLength } from "../modules/shop_data/shop_data.js";


const USE_EXISTING_BROWSER = true;

async function autoChatLink(items, excelFilePath, intervalMs = 3000) {
  const itemList = Array.isArray(items) ? items : [items];

  const browser = new Browser();
  if (USE_EXISTING_BROWSER) {
    await browser.connectToExistingBrowser();
  } else {
    await browser.launchBrowser();
  }

  for (const item of itemList) {
    const link = item.linkUrl;
    const rowIndex = item.rowIndex;

    console.log(`Start processing link: ${link} (row ${rowIndex + 2})`);

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
      const messageListLength = await getMessageListLength(chatPage);
      console.log(`Message list length: ${messageListLength}`);
      if (messageListLength < 2) {
        await sendMessage(chatPage);
        console.log(`Message sent successfully for link: ${link}`);
      }

    } catch (error) {
      console.log(`Failed to send message for link: ${link}`);
      console.log(`Error: ${error.message}`);
    }

    // 如果发送成功，更新 Excel 中的"是否发送"列
    // if (sendSuccess && excelFilePath && rowIndex !== undefined) {
    //   try {
    //     await updateExcelCell(excelFilePath, rowIndex, "是否发送", "是");
    //     console.log(`Updated Excel: row ${rowIndex + 2}, "是否发送" = "是"`);
    //   } catch (error) {
    //     console.log(`Failed to update Excel: ${error.message}`);
    //   }
    // }

    try {
      await chatPage.close();
    } catch (e) { }

    try {
      await browser.closePage();
    } catch (e) { }

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
const excelFilePath = path.resolve("input", "点赞链接.xlsx");
await autoChatLink(res, excelFilePath, 3000);