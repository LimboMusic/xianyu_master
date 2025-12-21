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

const keyword = "ppt模板";

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
    await browser.launchBrowser();
    console.log("Browser launched successfully");
    let count = 0;
    let page;
    let retryCount = 0;
    while (count === 0 && retryCount < 10) {
      page = await browser.navigateWithRetry(url);
      count = await page
        .locator('.feeds-item-wrap--rGdH_KoF:not([id="selected"])')
        .count();
      console.log("Initial count:", count);
      await sleep(1000);
      retryCount++;
    }

    let processedCount = 0;
    const maxProcessedPerSession = 999999; // 限制单次处理数量，避免资源耗尽
    await browser.ensurePageValid(url);

    while (count > 1 && processedCount < maxProcessedPerSession) {
      // 检查页面是否仍然有效，如果无效则重新创建
      await browser.ensurePageValid(url);
      count = await page
        .locator('.feeds-item-wrap--rGdH_KoF:not([id="selected"])')
        .count();
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
          console.log("No more elements to process");
          break;
        }

        const { reviewNumber, wantNumber } = await getReviewAndWantNumber(
          newPage
        );
        const description = await getLinkDescription(newPage);
        const imageUrls = await getImageUrls(newPage);
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
        if (result_list.length > 0 && result_list.length % 5 === 0) {
          const filename = path.join(
            output_dir_local,
            `${keyword.trim()}_${dayjs().format("YYYY-MM-DD")}.xlsx`
          );
          await exportToExcelFile(result_list, filename, "id");
        }

        if (count <= 2) {
          await gotoNextPage(page);
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
          // 重新计算剩余元素数量
          count = await page
            .locator('.cardWarp--dZodM57A:not([id="selected"])')
            .count();
          if (count === 0) break;
        } catch (countError) {
          console.log(`Failed to recount elements: ${countError.message}`);
          break; // 如果连计数都失败了，就停止
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
(async () => {
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
