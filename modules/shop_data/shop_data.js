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

  try {
    const context = page.context();
    // 用较短超时，快速检测是否打开新页面
    const newPagePromise = context.waitForEvent("page", { timeout: 5000 }).catch((err) => {
      // 超时正常返回 null，不抛出未捕获异常
      return null;
    });

    // 记录点击前的 URL，用于检测页面内导航（SPA 跳转）
    const beforeUrl = page.url();

    // 执行点击 - 用较短超时，点击失败快速返回
    try {
      await elementLocator.click({ timeout: 3000 });
    } catch (clickError) {
      // 点击失败，移除 selected 标记，快速返回
      console.log(`Click failed: ${clickError.message}`);
      try {
        await elementLocator.evaluate((element) => {
          element.id = "";
        });
      } catch (e) {
        // 忽略清除失败
      }
      return null;
    }

    // 点击后快速检查是否页面内跳转（URL 变了但没打开新标签页）
    const afterUrl = page.url();
    if (beforeUrl !== afterUrl) {
      // 页面内跳转，不是新标签页，这种情况也当作"没打开新页面"处理
      console.log(`Page navigated in same tab (SPA): ${afterUrl}`);
      try {
        await elementLocator.evaluate((element) => {
          element.id = "";
        });
      } catch (e) {
        // 忽略清除失败
      }
      return null;
    }

    // 快速检查新页面是否已经打开（检查当前页面数）
    const contexts = context.pages();
    if (contexts.length > 1) {
      // 已经有新页面了，直接取最新一个
      const latestPage = contexts[contexts.length - 1];
      if (latestPage !== page) {
        try {
          await latestPage.waitForLoadState("networkidle", { timeout: 8000 });
          return latestPage;
        } catch (e) {
          // 加载超时也关闭返回 null
          try { await latestPage.close(); } catch (ce) {}
          try {
            await elementLocator.evaluate((element) => { element.id = ""; });
          } catch (ce) {}
          return null;
        }
      }
    }

    // 等待新页面打开（短超时）
    let newPage = await newPagePromise;
    if (!newPage) {
      // 没打开新页面，重置元素标记
      console.log("No new page opened, resetting element");
      try {
        await elementLocator.evaluate((element) => {
          element.id = "";
        });
      } catch (e) {
        // 忽略清除失败
      }
      return null;
    }

    // 等待新页面加载完成
    try {
      await newPage.waitForLoadState("networkidle", { timeout: 8000 });
      return newPage;
    } catch (error) {
      console.log(`New page load timeout: ${error.message}`);
      try { await newPage.close(); } catch (closeError) {}
      try {
        await elementLocator.evaluate((element) => { element.id = ""; });
      } catch (e) {}
      return null;
    }
  } catch (error) {
    // 外层兜底
    console.log(`Unexpected error in gotoShopPage: ${error.message}`);
    try {
      await elementLocator.evaluate((element) => { element.id = ""; });
    } catch (e) {}
    return null;
  }
}

async function getIntroText(page) {
  const color = getRandomColor();
  const introLocator = page.locator(INTRO_CLASS_NAME).first();

  // 等待元素出现
  try {
    await introLocator.waitFor({ timeout: 5000 });
  } catch (error) {
    console.log("Intro element not found within timeout", page.url());
    return "";
  }

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

  // 提取"浏览"前面的文字（非贪婪匹配）
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
        num *= 10000; // 处理"万"单位
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

    return mediaUrlList;
  } catch (error) {
    console.log(`Warning: Failed to get media URLs: ${error.message}`);
    return [];
  }
}

async function gotoNextPage(page) {
  try {
    // 尝试多种选择器匹配翻页按钮（闲鱼 hash 类名可能变化）
    const selectors = [
      // 尝试包含 hash 的精确类名
      ".search-pagination-arrow-container--lt2kCP6J",
      // 尝试包含"下一页"文本的按钮
      'button:has-text("下一页")',
      // 尝试 aria-label 属性
      '[aria-label="下一页"]',
      // 尝试通用分页器箭头容器（部分匹配）
      '[class*="pagination-arrow"]',
      '[class*="pagination"] .next',
      // 尝试 span 文本
      'span:has-text("下一页")',
      // 通用包含"下一页"的链接/按钮
      'a:has-text("下一页")',
      // 最后手段：分页按钮区域最后一个非禁用按钮
      '[class*="pagination"] button:not([disabled]):last-child',
    ];

    let nextButton = null;
    let foundSelector = '';
    for (const selector of selectors) {
      const elements = page.locator(selector);
      const count = await elements.count().catch(() => 0);
      if (count > 0) {
        try {
          const isEnabled = await elements.first().isEnabled().catch(() => false);
          if (isEnabled) {
            nextButton = elements.first();
            foundSelector = selector;
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }

    if (!nextButton) {
      console.log("Next page button not found with any selector, skipping...");
      return;
    }

    console.log(`Found next page button with selector: ${foundSelector}`);
    
    // 滚动到分页区域
    try {
      await nextButton.scrollIntoViewIfNeeded({ timeout: 3000 });
    } catch (e) {
      // 忽略滚动失败
    }
    await sleep(500);
    
    await nextButton.click({ timeout: 10000 });
    console.log("Clicked next page button, waiting for page load...");
    await sleep(3000);
    
    // 等待新页面内容加载
    try {
      await page.waitForFunction(() => {
        const cards = document.querySelectorAll('.feeds-item-wrap--rGdH_KoF');
        for (const card of cards) {
          if (card.id !== 'selected') return true;
        }
        return false;
      }, { timeout: 10000 });
      console.log("New page content loaded");
    } catch (e) {
      console.log("Wait for new cards completed (or timeout)");
    }
    
  } catch (error) {
    // 捕获任何错误，不抛出，继续执行
    console.log(`Warning: Failed to go to next page: ${error.message}, continuing...`);
    return;
  }
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
