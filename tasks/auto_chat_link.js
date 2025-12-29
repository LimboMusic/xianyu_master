import { Browser } from "../utils/browser.js";
import { goToChatPage, getUserName } from "../modules/shop_data/shop_data.js";
import { sleep } from "../utils/utils.js";
import { extractLikeLinks } from "../utils/extract_like_links.js";
import path from "path";
import {
  getChatMessageListLength,
  sendMessage,
} from "../modules/chat_page/chat_page.js";
import { exportToExcelFile } from "../utils/file.js";

let DEFAULT_MESSAGE = "";
const ADDTIONAL_MESSAGE = "";
const userList = []
// DEFAULT_MESSAGE = "zhi顶，谢谢啦";

const USE_EXISTING_BROWSER = true;

const message_list = [
  "现在还有货吗？zhi顶，谢谢啦",
  "今天能发货吗？zhi顶，谢谢啦",
  "偏远地区要加多少邮费？置ding，谢谢宝子",
  "全新的吗？zhi顶，谢谢",
  "包邮吗?置ding，谢谢",
  "什么时候能发货，zhi顶，谢谢",
  "质保到什么时候？zhi顶，宝子",
  "还有吗？zhi顶哦",
  "zhi顶，谢谢啦",
  "zhi顶，谢谢",
  "zhi顶，感谢宝子",
  "宝子，zhi顶",
  "宝子，zhi顶，谢谢啦",
  "宝子，zhi顶，谢谢",
  "宝子，zhi顶，感谢宝子",
  "宝子，zhi顶，感谢宝子",
];

async function autoChatLink(items, excelFilePath, intervalMs = 3000) {
  const itemList = Array.isArray(items) ? items : [items];

  const browser = new Browser();
  if (USE_EXISTING_BROWSER) {
    await browser.connectToExistingBrowser();
  } else {
    await browser.launchBrowser();
  }

  let counter = 0;
  let consecutiveSkipCount = 0;

  for (const item of itemList) {
    const link = item.linkUrl;
    const rowIndex = item.rowIndex;

    console.log(`Start processing link: ${link} (row ${rowIndex + 2})`);

    let page = null;
    try {
      // 限制重试次数，避免长时间卡在一个链接上
      page = await browser.navigateWithRetry(link, { maxRetries: 3 });
    } catch (error) {
      console.log(
        `Failed to navigate to link, skip and go next. Link: ${link}`
      );
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
      const userName = await getUserName(page);
      userList.push({ '用户名': userName, '日期': dayjs().format('YYYY-MM-DD') });
      if(userList.length % 10 === 0) {
        await exportToExcelFile(userList, path.resolve("input", "点赞_用户列表.xlsx"), "用户名");
      }
    } catch (error) {
      console.log(`Failed to go to chat page for link: ${link}`);
      console.log(`Error: ${error.message}`);
    }

    if (!chatPage) {
      console.log(
        `Chat page not opened for link: ${link}, skip sending message.`
      );
      continue;
    }

    await sleep(intervalMs);

    try {
      counter++;
      const chatMessageListLength = await getChatMessageListLength(chatPage);
      console.log(`Have sent ${counter} messages`);
      console.log(`Chat message list length: ${chatMessageListLength}`);
      if (chatMessageListLength < 2) {
        let message = "";
        if (DEFAULT_MESSAGE !== "") {
          message = DEFAULT_MESSAGE + ADDTIONAL_MESSAGE;
        } else {
          message =
            message_list[Math.floor(Math.random() * message_list.length)] +
            ADDTIONAL_MESSAGE;
        }
        await sendMessage(chatPage, ["来啦", message]);
        console.log(`Message sent successfully for link: ${link}`);
        consecutiveSkipCount = 0; // 重置连续跳过计数
      } else {
        consecutiveSkipCount++;
        console.log(`Chat message list length is greater than 2, skip sending message. (连续跳过: ${consecutiveSkipCount})`);

        // 如果连续跳过10次，终止进程
        if (consecutiveSkipCount >= 10) {
          console.log(`连续跳过${consecutiveSkipCount}次，达到上限，终止进程...`);
          process.exit(0);
        }
      }
    } catch (error) {
      console.log(`Failed to send message for link: ${link}`);
      console.log(`Error: ${error.message}`);
    }

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
const excelFilePath = path.resolve("input", "汇总_点赞链接.xlsx");
await autoChatLink(res, excelFilePath, 3000);

// 所有任务完成后结束进程
console.log("All tasks completed, exiting process...");
process.exit(0);
