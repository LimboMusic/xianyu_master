import { Browser } from "../utils/browser.js";
import {
  selectCategory,
  clickNextButton,
  uploadImage,
  fillTitle,
  fillDescription,
  fillAddress,
  fillPrice,
  fillInventory,
  clickTimedPublishRadio,
  fillOuterId,
  clickServiceCheckboxs,
  clickSubmitButton,
} from "../modules/aqisuo/aqisuo.js";
import { sleep, waitForUserInput } from "../utils/utils.js";
import dayjs from "dayjs";
import {
  getNextPublishTime,
  recordPublish,
  getTodayCount,
  getTodayRecords,
  getLastPublishTime,
} from "../store/index.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** 本地图片路径（Node 不能用 import 加载 .jpg） */
const PROCESS_IMG_PATH = path.join(__dirname, "..", "input", "process_img.jpg");

/** selectCategory 失败时刷新页面重试的最大次数 */

const data = fs.readFileSync("input/汇总_资源.xlsx");
const workbook = XLSX.read(data, { type: "buffer" });
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data_list = XLSX.utils
  .sheet_to_json(sheet, { header: true })
  .filter((item) => item["已经定时发布"] !== "是");
console.log("data_list", data_list);

const browser = new Browser();

// 设置为 true 表示连接到手动打开的浏览器，false 表示启动新浏览器
const USE_EXISTING_BROWSER = true; // 修改这个变量来选择模式

// Windows 启动命令（推荐使用 IPv4 地址）：
// 方法1: 使用 start_chrome.bat 脚本（推荐）
// 方法2: 手动启动 Chrome（Chrome 实际位置）：
// "C:\Users\18176\AppData\Local\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1
//
// 如果 Chrome 在其他位置，常见位置：
// - C:\Program Files\Google\Chrome\Application\chrome.exe
// - C:\Program Files (x86)\Google\Chrome\Application\chrome.exe
// - C:\Users\<用户名>\AppData\Local\Google\Chrome\Application\chrome.exe
//
// 验证浏览器是否启动：访问 http://127.0.0.1:9222/json/version 查看是否返回数据
//
// https://aldsidle.agiso.com/#/goodsManage/goodsList/goodsRelease

async function publishLinks(data) {
  const MAX_CATEGORY_SELECT_RETRIES = 10;
  console.log("publishLink=====>", data);
  const outerId = data["编码"];
  const title = data["名称"];
  const description = data["标题"];
  const image = data["图片"];
  const nextPublishInfo = getNextPublishTime();
  const scheduledTime = nextPublishInfo.time;
  const scheduledDate = nextPublishInfo.date;
  const today = dayjs().format("YYYY-MM-DD");
  const isToday = scheduledDate === today;

  console.log(`\n📅 计划发布时间: ${scheduledTime}`);
  console.log(`📊 今天已记录安排: ${getTodayCount()} 次`);

  if (!isToday) {
    console.log(`ℹ️  定时日期: ${scheduledDate}`);
  }

  // 记录实际开始时间
  const actualStartTime = dayjs().format("YYYY-MM-DD HH:mm:ss");

  if (USE_EXISTING_BROWSER) {
    await browser.connectToExistingBrowser();
  } else {
    await browser.launchBrowser();
  }

  let page;
  try {
    page = await browser.navigateWithRetry(
      "https://aldsidle.agiso.com/#/goodsManage/goodsList/goodsRelease",
    );
    await page.waitForLoadState("networkidle");

    await sleep(1000);
    await sleep(1000);
    let category = false;
    for (let attempt = 0; attempt < MAX_CATEGORY_SELECT_RETRIES; attempt++) {
      category = await selectCategory(page);
      console.log(
        "category",
        category,
        `attempt ${attempt + 1}/${MAX_CATEGORY_SELECT_RETRIES}`,
      );
      if (category) break;
      if (attempt < MAX_CATEGORY_SELECT_RETRIES - 1) {
        console.log("分类未就绪，刷新页面后重试…");
        await page.reload({ waitUntil: "networkidle" });
        await sleep(1000);
      }
    }
    if (!category) {
      console.error("selectCategory 多次重试后仍失败，跳过本条");
      return false;
    }
    await sleep(2000);
    await clickNextButton(page);
    await sleep(2000);
    await uploadImage(page, image, true);
    await sleep(1000);
    await uploadImage(page, PROCESS_IMG_PATH, false);
    await sleep(1000);
    await fillTitle(page, title.slice(0, 30));
    await sleep(500);
    await fillDescription(page, description);
    await sleep(500);
    await fillAddress(page);
    await sleep(500);
    await fillPrice(page);
    await sleep(500);
    await fillInventory(page);
    await sleep(1000);
    // 使用计算出的定时发布时间
    await clickTimedPublishRadio(page, scheduledTime);
    await sleep(1000);
    await fillOuterId(page, outerId);
    await sleep(1000);
    await clickServiceCheckboxs(page);
    await sleep(1000);
    await clickSubmitButton(page);
    await sleep(1000);
    try {
      await page.waitForSelector(".ant-modal-footer button", { timeout: 5000 });
      await page.locator(".ant-modal-footer button").last().click();
    } catch (error) {
      console.log(
        `Warning: Close button not found or failed to click: ${error.message}`,
      );
    }

    // 记录发布成功（不依赖页面，先于关闭标签页）
    const actualEndTime = dayjs().format("YYYY-MM-DD HH:mm:ss");
    recordPublish({
      actualTime: actualEndTime,
      scheduledTime: scheduledTime,
    });

    console.log(`✓ 发布成功！`);
    console.log(`   实际发布时间: ${actualEndTime}`);
    console.log(`   定时发布时间: ${scheduledTime}`);
    console.log(`   今天已记录安排: ${getTodayCount()} 次`);

    return true;
  } finally {
    if (page) {
      try {
        await page.close();
        console.log("已关闭当前发布标签页");
      } catch (e) {
        console.log(`关闭标签页失败: ${e.message}`);
      }
    }
    await sleep(5000);
  }
}

async function runPublishLoop() {
  console.log("=== 开始发布任务 ===");

  // 显示当前状态
  const lastPublishTime = getLastPublishTime();
  if (lastPublishTime) {
    console.log(`最后一次发布时间: ${lastPublishTime}`);
  } else {
    console.log("这是第一次发布");
  }

  console.log(`今天已记录安排: ${getTodayCount()} 次\n`);

  // 显示今天的发布记录
  const todayRecords = getTodayRecords();
  if (todayRecords.length > 0) {
    console.log("今天的发布记录:");
    todayRecords.forEach((record, index) => {
      console.log(
        `  ${index + 1}. 定时: ${record.scheduledTime} | 实际: ${record.actualTime}`,
      );
    });
    console.log("");
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < data_list.length; i++) {
    try {
      const item = data_list[i];
      const success = await publishLinks(item);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }

      // 等待一段时间再继续
      await sleep(2000);
    } catch (error) {
      console.error(`✗ 发布失败: ${error.message}`);
      console.error(error.stack);
      failCount++;
      await sleep(3000);
    }
  }

  console.log("\n=== 发布任务完成 ===");
  console.log(`成功发布: ${successCount} 次`);
  console.log(`失败: ${failCount} 次`);
  console.log(`今天已记录安排: ${getTodayCount()} 次`);

  // 显示下次可发布时间
  const nextPublishInfo = getNextPublishTime();
  const nextDate = dayjs(nextPublishInfo.time).format("YYYY-MM-DD");
  const today = dayjs().format("YYYY-MM-DD");

  if (nextDate === today) {
    console.log(`\n下次可发布时间: ${nextPublishInfo.time} (今天)`);
  } else {
    console.log(`\n下次可发布时间: ${nextPublishInfo.time} (${nextDate})`);
  }
}

// 运行发布循环，可以指定要发布的数量
// 例如：runPublishLoop(10) 表示要发布10条
runPublishLoop(5).catch((error) => {
  console.error("程序执行出错:", error);
  process.exit(1);
});
