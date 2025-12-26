import { chromium } from "playwright";
import { sleep } from "../utils/utils.js";
import { exportToExcelFile } from "../utils/file.js";
import dayjs from "dayjs";
import fs from "fs";
import * as XLSX from "xlsx";
import { Browser } from "../utils/browser.js";
import {
  gotoShopPage,
  getReviewAndWantNumber,
  getLinkDescription,
  getImageUrls
} from "../modules/shop_data/shop_data.js";

const url = 'https://m.tb.cn/h.7fhgjkr?tk=mvsCfC5KhNt'
const shop_name = '咕咕资源库'

const result_list = [];
const browser = new Browser();
const output_dir = `output/${dayjs().format("YYYY-MM-DD")}/店铺所有链接数据`;
fs.mkdirSync(output_dir, { recursive: true });

async function getShopLinks(url, shop_name) {
  try {
    await browser.launchBrowser();
    const page = await browser.navigateWithRetry(url);

    let count = await page
      .locator('.cardWarp--dZodM57A:not([id="selected"])')
      .count();
    console.log("Initial count:", count);

    let processedCount = 0;
    const maxProcessedPerSession = 999999; // 限制单次处理数量，避免资源耗尽

    while (count > 0 && processedCount < maxProcessedPerSession) {
      // 检查页面是否仍然有效，如果无效则重新创建
      await browser.ensurePageValid(url);
      count = await page
        .locator('.cardWarp--dZodM57A:not([id="selected"])')
        .count();
      try {
        const newPage = await gotoShopPage(
          page,
          '.cardWarp--dZodM57A:not([id="selected"])'
        );
        
        // 如果返回 null，可能是元素不存在或超时失败
        // 先检查是否还有元素，如果没有元素了，说明处理完成
        if (!newPage) {
          // 重新检查是否还有未处理的元素
          const remainingCount = await page
            .locator('.cardWarp--dZodM57A:not([id="selected"])')
            .count();
          if (remainingCount === 1) {
            console.log("No more elements to process");
            break;
          } else {
            // 还有元素但打开失败，跳过当前项继续下一个
            console.log("Failed to open shop page, skipping this item and continuing...");
            await sleep(2000);
            continue;
          }
        }

        // 检查 newPage 是否是有效的 Page 对象（兼容旧代码可能返回字符串的情况）
        if (typeof newPage === 'string' || typeof newPage.locator !== 'function') {
          console.log("Invalid page object returned, skipping this item");
          // 如果 newPage 是 Page 对象但无效，尝试关闭它
          if (newPage && typeof newPage.close === 'function') {
            try {
              await newPage.close();
            } catch (closeError) {
              // 忽略关闭错误
            }
          }
          // 跳过当前项，继续下一个
          await sleep(2000);
          continue;
        }

        await sleep(1000);

        const { reviewNumber, wantNumber } = await getReviewAndWantNumber(
          newPage
        );
        const description = await getLinkDescription(newPage);
        const image = await getImageUrls(newPage, false);
        const linkUrl = await newPage.url();
        const obj = {
          店铺名: shop_name,
          浏览量: reviewNumber,
          想要人数: wantNumber,
          图片: image,
          链接: linkUrl,
          标题: description,
          名称: description.slice(0, 10),
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
          .locator('.cardWarp--dZodM57A:not([id="selected"])')
          .count();
        console.log(`Remaining count: ${count}, Processed: ${processedCount}`);

        // 定期保存进度
        if (result_list.length > 0 && result_list.length % 5 === 0) {
          await exportToExcelFile(
            result_list,
            `${output_dir}/${shop_name.trim()}_${dayjs().format(
              "YYYY-MM-DD"
            )}.xlsx`,
            "名称"
          );
        }

        await sleep(2000);
      } catch (error) {
        console.log(`Error processing element: ${error.message}`);

        // 如果是超时错误或页面打开失败，跳过当前项继续下一个
        if (
          error.message.includes("Timeout") ||
          error.message.includes("waitForEvent") ||
          error.message.includes("locator is not a function")
        ) {
          console.log("Skipping this item due to timeout or page error, continuing to next...");
          await sleep(2000);
          
          // 重新计算剩余元素数量
          try {
            count = await page
              .locator('.cardWarp--dZodM57A:not([id="selected"])')
              .count();
            if (count === 0) break;
          } catch (countError) {
            console.log(`Failed to recount elements: ${countError.message}`);
            // 如果计数失败，继续尝试而不是直接退出
          }
          continue; // 跳过当前项，继续下一个
        }

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
      await exportToExcelFile(
        result_list,
        `${output_dir}/${shop_name.trim()}_${dayjs().format(
          "YYYY-MM-DD"
        )}.xlsx`,
        "名称"
      );
    }

    browser.closeBrowser();
    return result_list;
  } catch (error) {
    console.log(`Error in getShopLinks: ${error.message}`);
    try {
      if (browser.browser) {
        await browser.closeBrowser();
      }
    } catch (closeError) {
      console.log(`Error closing browser: ${closeError.message}`);
    }
    return result_list; // 返回已处理的结果
  }
}

// const fileBuffer = fs.readFileSync("input/汇总_店铺.xlsx");
// const workbook = XLSX.read(fileBuffer, { type: "buffer" });
// const sheetName = workbook.SheetNames[0];
// const sheet = workbook.Sheets[sheetName];
// const data = XLSX.utils.sheet_to_json(sheet, { header: true });

// console.log("data", data);

// for (const row of data) {
//     const url = row['店铺网址'];
//     if (url) {
//         await getShopLinks(url, row['店铺名']);
//         await sleep(1000);
//     }
// }

getShopLinks(
  url,
  shop_name
);
