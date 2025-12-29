import { getRandomColor } from "../../utils/color.js";
import { sleep } from "../../utils/utils.js";

const FIRST_CARD_CLASS_NAME = ".feeds-item-wrap--rGdH_KoF";
const INTRO_CLASS_NAME = ".item-user-info-intro--ZN1A0_8Y";
const WANT_CLASS_NAME = "div.want--ecByv3Sr";
const DESCRIPTION_CLASS_NAME = "span.desc--GaIUKUQY";
const USER_NAME_CLASS_NAME = ".item-user-info-nick--rtpDhkmQ";
const IMAGE_URL_CLASS_NAME = "div[data-index]:not([data-index='-1']) .carouselItem--jwFj0Jpa img";
const VIDEO_URL_CLASS_NAME = ".react-player--eSd7xhPi source";
const CHAT_BUTTON_CLASS_NAME = "a.want--ecByv3Sr";


async function gotoShopPage(page, className = FIRST_CARD_CLASS_NAME) {
  const elementLocator = page.locator(className).first();

  // 检查元素是否存在
  if ((await elementLocator.count()) === 0) {
    console.log(
      `Element with className "${className}" not found on page ${page.url()}`
    );
    return null;
  }

  const color = getRandomColor();
  try {
    await elementLocator.evaluate((element, color) => {
      element.style.backgroundColor = color;
      element.id = "selected";
    }, color);
  } catch (error) {
    console.log(`Failed to highlight element: ${error.message}`);
    // 即使高亮失败，也继续执行点击操作
  }

  const context = page.context();
  const newPagePromise = context.waitForEvent("page", { timeout: 10000 });
  await elementLocator.click();

  let newPage;
  try {
    newPage = await newPagePromise;
  } catch (error) {
    if (
      error.message.includes("Timeout") ||
      error.message.includes("waitForEvent")
    ) {
      console.log(
        `Warning: Failed to open shop page (timeout waiting for page event): ${error.message}`
      );
      return null; // 返回 null 表示失败，让调用方处理
    }
    return null;
  }

  try {
    await newPage.waitForLoadState("networkidle", { timeout: 10000 });
    return newPage;
  } catch (error) {
    if (
      error.message.includes("Timeout") ||
      error.message.includes("waitForLoadState")
    ) {
      console.log(
        `Warning: Page load timeout for shop page, skipping this item: ${error.message}`
      );
      try {
        await newPage.close();
      } catch (closeError) {
        // 忽略关闭错误
      }
      return null; // 返回 null 表示失败
    }
    return null;
  }
}

async function getIntroText(page) {
  const color = getRandomColor();
  const introLocator = page.locator(INTRO_CLASS_NAME).first();

  // 如果没找到元素就跳过背景色设置
  if ((await introLocator.count()) > 0) {
    await introLocator.evaluate((element, color) => {
      element.style.backgroundColor = color;
    }, color);
  }

  const introElement = introLocator;
  if ((await introElement.count()) === 0) {
    console.log("Intro element not found", page.url());
    return "";
  }
  return await introElement.innerText();
}

async function getReviewAndWantNumber(page) {
  const color = getRandomColor();
  const wantLocator = page.locator(WANT_CLASS_NAME).first();
  await wantLocator.waitFor({ timeout: 10000 });

  // 如果没找到元素就跳过背景色设置
  if ((await wantLocator.count()) > 0) {
    await wantLocator.evaluate((element, color) => {
      element.style.backgroundColor = color;
    }, color);
  }

  const wantElement = wantLocator;
  if ((await wantElement.count()) === 0) {
    console.log("Want element not found", page.url());
    return { reviewNumber: 0, wantNumber: 0 };
  }
  const reviewNumberText = await wantElement.innerText(); // 假设这是原有行
  console.log("Review Number Text:", reviewNumberText);

  // 提取“浏览”前面的文字（非贪婪匹配）
  const reviewPrefixMatch = reviewNumberText.match(/(.+?)浏览/);
  let reviewNumber = 0;
  if (reviewPrefixMatch && reviewPrefixMatch[1]) {
    const prefix = reviewPrefixMatch[1].trim(); // 提取的文字，如 "2万" 或 "20000"
    console.log('Extracted Prefix before "浏览":', prefix); // 用于调试

    // 进一步解析 prefix
    const numMatch = prefix.match(/(\d+(\.\d+)?)/); // 匹配数字，可能带小数
    if (numMatch && numMatch[0]) {
      let num = parseFloat(numMatch[0]);
      if (prefix.includes("万")) {
        num *= 10000; // 处理“万”单位
      }
      reviewNumber = Math.round(num); // 取整，确保整数
    }
  } else {
    console.log('No prefix found before "浏览"'); // 或 throw new Error(...)
  }
  const wantNumberMatch = reviewNumberText.match(/(\d+)人想要/);
  let wantNumber = 0;
  if (wantNumberMatch && wantNumberMatch[1]) {
    wantNumber = parseInt(wantNumberMatch[1], 10);
  } else {
    console.log("Want number not found", page.url());
    wantNumber = 0;
  }
  return { reviewNumber, wantNumber };
}

async function getLinkDescription(page) {
  const color = getRandomColor();
  const linkDescriptionLocator = page.locator(DESCRIPTION_CLASS_NAME).first();
  if ((await linkDescriptionLocator.count()) > 0) {
    await linkDescriptionLocator.evaluate((element, color) => {
      element.style.backgroundColor = color;
    }, color);
  } else {
    return "";
  }
  return (await linkDescriptionLocator.innerText()) || "";
}

async function getUserName(page) {
  const color = getRandomColor();
  const userNameLocator = page.locator(USER_NAME_CLASS_NAME).first();
  if ((await userNameLocator.count()) > 0) {
    await userNameLocator.evaluate((element, color) => {
      element.style.backgroundColor = color;
    }, color);
  } else {
    return "";
  }
  return (await userNameLocator.innerText()) || "";
}

async function getImageUrls(page, is_multiple = true) {
  try {
    const mediaUrlList = [];

    // 获取所有媒体URL (图片和视频)
    const mediaLocators = page.locator(
      `${IMAGE_URL_CLASS_NAME}, ${VIDEO_URL_CLASS_NAME}`
    );
    if ((await mediaLocators.count()) > 0) {
      const mediaElements = await mediaLocators.all();
      for (const element of mediaElements) {
        const src = (await element.getAttribute("src")) || "";
        if (src) mediaUrlList.push(src);
      }

      if (is_multiple === false) {
        return mediaUrlList[0];
      }
    }

    return JSON.parse(mediaUrlList);
  } catch (error) {
    console.log(`Warning: Failed to get media URLs: ${error.message}`);
    return [];
  }
}

async function gotoNextPage(page) {
  await page
    .locator(".search-pagination-arrow-container--lt2kCP6J")
    .nth(1)
    .click();
  await sleep(5000);
}

async function extractItemId(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get("id");
  } catch (error) {
    console.log(
      `Warning: Failed to extract item ID from URL ${url}: ${error.message}`
    );
    return url;
  }
}

async function goToChatPage(page) {
  const chatButtonLocator = page.locator(CHAT_BUTTON_CLASS_NAME).first();
  if ((await chatButtonLocator.count()) > 0) {
    const [childPage] = await Promise.all([
      page.waitForEvent("popup"),
      chatButtonLocator.click(),
    ]);
    await sleep(2000);
    return childPage;
  }
  return null;
}



export {
  gotoShopPage,
  getIntroText,
  getReviewAndWantNumber,
  getLinkDescription,
  getUserName,
  getImageUrls,
  gotoNextPage,
  extractItemId,
  goToChatPage,

};
