import { chromium } from "playwright";
import { sleep } from "../utils/utils.js";
import { exportToExcelFile } from "../utils/file.js";
import dayjs from "dayjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Browser } from "../utils/browser.js";
import {
  gotoShopPage,
  getReviewAndWantNumber,
  getLinkDescription,
  getImageUrls,
  getUserName,
  gotoNextPage,
  extractItemId,
} from "../modules/shop_data/shop_data.js";
import { ensureChromeRemoteDebugging } from "../utils/chrome_remote_debug.js";

const keyword = "真题电子";




const USE_EXISTING_BROWSER = true

const CHORME_STARTER_NAME = "start_chrome.bat";

/** 连接本机 Chrome 前若 9222 无 CDP，则自动运行项目根目录的 start_chrome.bat（仅 Windows） */
const AUTO_START_CHROME_BAT = true;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 确保输出目录存在，支持多种创建方式
 * @param {string} relativePath - 相对路径，如 'output/2025-12-17/关键词数据'
 * @param {string} baseDir - 基础目录，默认为项目根目录
 * @returns {string} 创建的目录的绝对路径nvm
 */
function ensureOutputDir(relativePath, baseDir = path.join(__dirname, "..")) {
  // 方法1: 尝试使用相对路径创建
  let outputDir = relativePath;
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    return path.resolve(outputDir);
  } catch (error) {
    // 方法2: 如果失败，使用绝对路径重试
    try {
      outputDir = path.join(baseDir, relativePath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      return outputDir;
    } catch (retryError) {
      // 方法3: 如果还是失败，尝试逐级创建
      try {
        const parts = path.join(baseDir, relativePath).split(path.sep);
        let currentPath = "";
        for (const part of parts) {
          if (part) {
            currentPath = currentPath ? path.join(currentPath, part) : part;
            if (!fs.existsSync(currentPath)) {
              fs.mkdirSync(currentPath);
            }
          }
        }
        return currentPath;
      } catch (fallbackError) {
        console.warn(
          `Warning: Failed to create directory ${relativePath}: ${fallbackError.message}`
        );
        // 返回相对路径，让 exportToExcelFile 尝试创建
        return relativePath;
      }
    }
  }
}

async function getShopLinks(url, keyword) {
  await ensureChromeRemoteDebugging({
    enabled: USE_EXISTING_BROWSER && AUTO_START_CHROME_BAT,
    batPath: path.resolve(CHORME_STARTER_NAME),
  });
  await sleep(2000);
  // 在函数内部初始化，避免顶层执行导致段错误
  const result_list = [];
  const browser = new Browser();
  const output_dir = `output/${dayjs().format("YYYY-MM-DD")}/关键词数据`;
  let output_dir_absolute = null;
  try {
    // 确保输出目录存在
    if (!output_dir_absolute) {
      output_dir_absolute = ensureOutputDir(output_dir);
    }
    const output_dir_local = output_dir_absolute;

    console.log("Launching browser...");
    if (USE_EXISTING_BROWSER) {
      await browser.connectToExistingBrowser();
    } else {
      await browser.launchBrowser();
    }
    console.log("Browser launched successfully");
    let count = 0;
    let page;
    let retryCount = 0;
    while (count === 0 && retryCount < 10) {
      page = await browser.navigateWithRetry(url);
      count = await page
        .locator('.feeds-item-wrap--rGdH_KoF')
        .count();
      console.log("Initial count:", count);
      await sleep(1000);
      retryCount++;
    }

    let processedCount = 0;
    const maxProcessedPerSession = 999999; // 限制单次处理数量，避免资源耗尽
    await browser.ensurePageValid(url);

    // 每次循环从 browser.page 获取最新 page 引用，防止 ensurePageValid 重建后变量失效
    const getPage = () => browser.page;

    // 记录连续同一元素处理失败的次数，如果反复失败则尝试翻页
    let stuckRetryCount = 0;
    const MAX_STUCK_RETRY = 5;

    while (count >= 1 && processedCount < maxProcessedPerSession) {
      // 获取最新 page 引用（ensurePageValid 可能重建了 page）
      page = getPage();
      if (!page) {
        console.log("Page is null, attempting to recreate...");
        await browser.ensurePageValid(url);
        page = getPage();
        if (!page) {
          console.log("Failed to recreate page, exiting loop");
          break;
        }
      }

      // 检查页面是否仍然有效，如果无效则重新创建
      await browser.ensurePageValid(url);
      page = getPage(); // 重新获取 page 引用
      await sleep(1000);

      count = await page
        .locator('.feeds-item-wrap--rGdH_KoF:not([id="selected"])')
        .count();

      // 如果没有未处理的元素，尝试翻页
      if (count === 0) {
        console.log("No more unprocessed elements, trying next page...");
        await gotoNextPage(page);
        await sleep(5000);
        // 翻页后重新统计
        count = await page
          .locator('.feeds-item-wrap--rGdH_KoF:not([id="selected"])')
          .count();
        if (count === 0) {
          console.log("No new elements found after page turn, exiting loop");
          break;
        }
        console.log(`Found ${count} elements on next page, continuing...`);
        stuckRetryCount = 0; // 重置失败计数
        continue;
      }

      try {
        const newPage = await gotoShopPage(
          page,
          '.feeds-item-wrap--rGdH_KoF:not([id="selected"])'
        );

        if (newPage === "error page") {
          console.log("Error page, waiting 3 seconds and continue");
          await sleep(3000);
          continue;
        }
        if (!newPage) {
          // 检查是否真的没有更多元素，还是只是当前元素加载失败
          const currentCount = await page
            .locator('.feeds-item-wrap--rGdH_KoF:not([id="selected"])')
            .count();
          if (currentCount === 0) {
            // 先尝试翻页，而不是直接退出
            console.log("Element disappeared, trying next page...");
            await gotoNextPage(page);
            await sleep(5000);
            count = await page
              .locator('.feeds-item-wrap--rGdH_KoF:not([id="selected"])')
              .count();
            if (count === 0) {
              console.log("No more pages available, exiting loop");
              break;
            }
            continue;
          } else {
            // 检查是否反复点击同一个位置失败（卡在最后一两个元素）
            stuckRetryCount++;
            if (stuckRetryCount >= MAX_STUCK_RETRY) {
              console.log(`Stuck on remaining ${currentCount} elements after ${stuckRetryCount} retries, trying next page...`);
              await gotoNextPage(page);
              await sleep(5000);
              count = await page
                .locator('.feeds-item-wrap--rGdH_KoF:not([id="selected"])')
                .count();
              if (count === 0) {
                console.log("No more pages available, exiting loop");
                break;
              }
              stuckRetryCount = 0;
              continue;
            }
            console.log(`Page load failed for current element (retry ${stuckRetryCount}/${MAX_STUCK_RETRY}), ${currentCount} elements remain. Trying next element...`);
            continue;
          }
        }

        // 成功打开新页面，重置卡住计数
        stuckRetryCount = 0;

        const { reviewNumber, wantNumber } = await getReviewAndWantNumber(
          newPage
        );
        const description = await getLinkDescription(newPage);
        const imageUrls = await getImageUrls(newPage, false);
        const userName = await getUserName(newPage);
        const linkUrl = await newPage.url();
        const id = await extractItemId(linkUrl || "");
        const obj = {
          id,
          浏览量: reviewNumber,
          想要人数: wantNumber,
          链接: linkUrl,
          名称: description.slice(0, 10),
          标题: description,
          图片: imageUrls,
          用户名: userName,
        };
        console.log("Processed:", obj);
        result_list.push(obj);

        // 确保新页面被正确关闭
        try {
          await newPage.close();
        } catch (closeError) {
          console.log(
            `Warning: Failed to close new page: ${closeError.message}`
          );
        }

        processedCount++;

        // 滚动页面以加载更多内容
        await page.evaluate(() => {
          window.scrollBy(0, 800);
        });

        // 等待新内容加载
        await sleep(1500);

        // 重新计算剩余元素数量
        count = await page
          .locator('.feeds-item-wrap--rGdH_KoF:not([id="selected"])')
          .count();
        console.log(`Remaining count: ${count}, Processed: ${processedCount}`);

        // 定期保存进度
        if (result_list.length > 0 && result_list.length % 10 === 0) {
          const filename = path.join(
            output_dir_local,
            `${keyword.trim()}_${dayjs().format("YYYY-MM-DD")}.xlsx`
          );
          await exportToExcelFile(result_list, filename, "id");
        }

        await sleep(800);
      } catch (error) {
        console.log(`Error processing element: ${error.message}`);

        // 如果是严重错误（如页面崩溃），等待更长时间
        if (
          error.message.includes("crashed") ||
          error.message.includes("detached")
        ) {
          console.log("Detected page crash, waiting longer before retry...");
          await sleep(5000);
        }

        try {
          // 重新获取最新 page 引用后计算剩余元素数量
          page = getPage();
          if (page) {
            count = await page
              .locator('.feeds-item-wrap--rGdH_KoF:not([id="selected"])')
              .count();
            console.log(`Error recovery - Remaining count: ${count}, Processed: ${processedCount}`);
          } else {
            console.log("Page lost after error, exiting loop");
            break;
          }
          if (count === 0) {
            // 尝试翻页
            console.log("Error recovery - trying next page...");
            await gotoNextPage(page);
            await sleep(5000);
            count = await page
              .locator('.feeds-item-wrap--rGdH_KoF:not([id="selected"])')
              .count();
            if (count === 0) break;
          }
        } catch (countError) {
          console.log(`Failed to recount elements: ${countError.message}`);
          break;
        }

        await sleep(3000);
      }
    }

    // 最终保存结果
    if (result_list.length > 0) {
      const filename = path.join(
        output_dir_local,
        `${keyword.trim()}_${dayjs().format("YYYY-MM-DD")}.xlsx`
      );
      await exportToExcelFile(result_list, filename, "id");
    }

    await browser.closeBrowser();
    return result_list;
  } catch (error) {
    console.error(`Error in getShopLinks: ${error.message}`);
    console.error(error.stack);
    // 保存已处理的结果
    if (result_list.length > 0) {
      try {
        const final_output_dir =
          output_dir_absolute || ensureOutputDir(output_dir);
        const filename = path.join(
          final_output_dir,
          `${keyword.trim()}_${dayjs().format("YYYY-MM-DD")}.xlsx`
        );
        await exportToExcelFile(result_list, filename);
      } catch (saveError) {
        console.error(`Error saving results: ${saveError.message}`);
      }
    }
    return result_list; // 返回已处理的结果
  } finally {
    // 确保浏览器被关闭
    try {
      if (browser && browser.browser) {
        await browser.closeBrowser();
      }
    } catch (closeError) {
      // 忽略关闭错误
      console.error(`Error closing browser in finally: ${closeError.message}`);
    }
  }
}

// 使用立即执行的异步函数包装顶层 await，避免段错误
await (async () => {
  try {
    await getShopLinks(
      `https://www.goofish.com/search?q=${keyword}&spm=a21ybx.search.searchInput.0`,
      keyword
    );
  } catch (error) {
    console.error("程序执行出错:", error);
    process.exit(1);
  }
})();

// 所有任务完成后结束进程
console.log('All tasks completed, exiting process...');
process.exit(0);
