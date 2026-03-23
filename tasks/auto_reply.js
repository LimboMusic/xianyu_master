import { Browser } from "../utils/browser.js";
import { sleep } from "../utils/utils.js";
import {
  getMessageListLength,
  scrollDownMessageList,
  clickChatRedPoint,
  getChatHeadText,
  sendMessage,
  CONVERSATION_ITEM_CLASS_NAME,
} from "../modules/chat_page/chat_page.js";
import path from "path";
import { ensureChromeRemoteDebugging } from "../utils/chrome_remote_debug.js";

const url =
  "https://www.goofish.com/im?spm=a21ybx.home.sidebar.2.4c053da6TfOP2U";

let DEFAULT_MESSAGE = "";
const ADDTIONAL_MESSAGE = "";
// DEFAULT_MESSAGE = "来啦";

const USE_EXISTING_BROWSER = true;
/** 连接本机 Chrome 前若 9222 无 CDP，则自动运行项目根目录的 start_chrome.bat（仅 Windows） */
const AUTO_START_CHROME_BAT = true;

const message_list = [
  "来啦",
  "在的",
  "来了",
  "在呢",
  "宝子，在的",
  "宝子，来了",
  "宝子，在",
  "亲，你好",
  "亲，来了",
];

async function autoReply(url) {
  await ensureChromeRemoteDebugging({
    enabled: USE_EXISTING_BROWSER && AUTO_START_CHROME_BAT,
    batPath: path.resolve(CHORME_STARTER_NAME),
  });
  await sleep(2000);
  const browser = new Browser();
  if (USE_EXISTING_BROWSER) {
    await browser.connectToExistingBrowser(9222, { newTab: CONNECT_NEW_TAB });
  } else {
    await browser.launchBrowser();
  }
  await sleep(1000);
  const page = await browser.navigateWithRetry(url);
  // 等待 IM 页关键结构出现，避免未加载完就点小红点
  try {
    await page.waitForURL(/goofish\.com\/im|im\?/, { timeout: 30000 });
  } catch {
    /* 部分环境 URL 可能带 hash，不强依赖 */
  }
  await page
    .locator(CONVERSATION_ITEM_CLASS_NAME)
    .first()
    .waitFor({ state: "visible", timeout: 45000 })
    .catch(() => {});
  await sleep(1500);
  let chatRedPointCount = await clickChatRedPoint(page);
  let consecutiveZeroCount = 0; // 连续滚动后redPointCount为0的次数计数器
  const MAX_CONSECUTIVE_ZERO = 10; // 连续10次为0时结束循环

  while (chatRedPointCount > 0 || (await getMessageListLength(page)) > 0) {
    await sleep(2000);
    const chatHeadText = await getChatHeadText(page);
    console.log(`Chat red point count: ${chatRedPointCount}`);
    console.log(
      `Consecutive zero count: ${consecutiveZeroCount}/${MAX_CONSECUTIVE_ZERO}`,
    );
    await sleep(1000);
    if ( chatHeadText.length > 0) {
      console.log(`Chat head text: ${chatHeadText}`);
      if (
        !/提醒收货|取消订单|直接买|去评价|交易中|去购买|立即购买|提醒发货|确认收货|购买|购|买/.test(
          chatHeadText,
        )
      ) {
        let message = "";
        if (DEFAULT_MESSAGE !== "") {
          message = DEFAULT_MESSAGE + ADDTIONAL_MESSAGE;
        } else {
          message =
            message_list[Math.floor(Math.random() * message_list.length)] +
            ADDTIONAL_MESSAGE;
        }
        await sendMessage(
          page,
          DEFAULT_MESSAGE + ADDTIONAL_MESSAGE ||
            message_list[Math.floor(Math.random() * message_list.length)] +
              ADDTIONAL_MESSAGE,
        );
        await sleep(1000);
      }
    }
    await sleep(1000);
    chatRedPointCount = await clickChatRedPoint(page);
    if (chatRedPointCount === 0 && (await getMessageListLength(page)) > 0) {
      await scrollDownMessageList(page, 1000);
      await sleep(1000);
      consecutiveZeroCount++; // 滚动后redPointCount仍为0，计数器加1

      // 如果连续10次滚动后都发现redPointCount为0，结束循环
      if (consecutiveZeroCount >= MAX_CONSECUTIVE_ZERO) {
        console.log(`连续${MAX_CONSECUTIVE_ZERO}次滚动后仍无新消息，结束循环`);
        return await getMessageListLength(page);
      }
    } else {
      consecutiveZeroCount = 0; // 如果redPointCount不为0，重置计数器
    }
  }
  await browser.closeBrowser();
  return 0;
}

let remaningMessageListLength = 1;
let retryTimes = 0;
/** 连续多少次「剩余列表长度为 0」后才真正结束（避免偶发一次为 0 就退出） */
const MAX_CONSECUTIVE_ZERO_REMAINING = 10;
/** 外层：本轮检测到「还有会话列表数量」>0 时，等待多少秒再跑下一轮（长轮询新消息） */
const SLEEP_SEC_WHEN_HAS_REMAINING = 3;
/** 外层：本轮返回 0 时等待多少秒再确认一次（不必 5 分钟，否则像卡住；凑满连续 10 次 0 才退出） */
const SLEEP_SEC_WHEN_ZERO = 3;
let consecutiveZeroRemaining = 0;

function logSleepSeconds(sec, reason) {
  const until = new Date(Date.now() + sec * 1000).toLocaleTimeString();
  console.log(`⏳ ${reason}，等待 ${sec} 秒…（约 ${until} 继续）`);
}

while (true) {
  remaningMessageListLength = await autoReply(url);
  retryTimes++;
  console.log(
    `Remaining message list length: ${remaningMessageListLength}, retry times: ${retryTimes}`,
  );
  if (remaningMessageListLength > 0) {
    consecutiveZeroRemaining = 0;
    logSleepSeconds(
      SLEEP_SEC_WHEN_HAS_REMAINING,
      "列表仍显示有会话，下一轮轮询",
    );
    await sleep(SLEEP_SEC_WHEN_HAS_REMAINING * 1000);
  } else {
    consecutiveZeroRemaining++;
    console.log(
      `Remaining message list length is 0 (${consecutiveZeroRemaining}/${MAX_CONSECUTIVE_ZERO_REMAINING})`,
    );
    if (consecutiveZeroRemaining >= MAX_CONSECUTIVE_ZERO_REMAINING) {
      console.log(
        `连续 ${MAX_CONSECUTIVE_ZERO_REMAINING} 次 Remaining message list length 为 0，终止`,
      );
      break;
    }
    logSleepSeconds(
      SLEEP_SEC_WHEN_ZERO,
      "本轮列表为 0，等待后再次执行 autoReply 以确认",
    );
    await sleep(SLEEP_SEC_WHEN_ZERO * 1000);
  }
}

// 所有任务完成后结束进程
console.log("All tasks completed, exiting process...");
process.exit(0);
