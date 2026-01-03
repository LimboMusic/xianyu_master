import { sleep } from "../../utils/utils.js";

const MESSAGE_ITEM_CLASS_NAME = ".message-section";
const CHAT_GROUPS_CLASS_NAME = ".list_items >div";
const CHAT_CONTAINER_CLASS_NAME = ".scroller";

// 备用的消息元素选择器列表
const MESSAGE_SELECTORS = [
  '.message-section',
  '[data-testid*="message"]',
  '.message',
  '.chat-message',
  '.msg-content',
  '.message-content',
  '[class*="message"]',
  '.list-item',
  '.item'
];

// 调试函数：检查页面上的消息元素
// 调试消息元素的任务（可以单独运行来测试选择器）
export async function debugMessageElementsTask() {
  const { Browser } = await import("../utils/browser.js");
  const { sleep } = await import("../utils/utils.js");
  const USE_EXISTING_BROWSER = true;

  const browser = new Browser();
  if (USE_EXISTING_BROWSER) {
    await browser.connectToExistingBrowser();
  } else {
    await browser.launchBrowser();
  }

  await sleep(1000);
  const page = await browser.navigateWithRetry("https://fqacf6r7ojb.feishu.cn/next/messenger/?from=messenger_banner_login&app_id=11");

  // 点击聊天组
  await clickChatGroup(page);
  await sleep(2000);

  // 调试消息元素
  await debugMessageElements(page);

  await browser.closeBrowser();
}

// 调试消息元素（开发时使用）
export async function debugMessageElements(page) {
  try {
    console.log('=== 调试消息元素 ===');

    // 检查各种可能的聊天消息选择器
    const selectors = [
      '.message-section',
      '[data-testid*="message"]',
      '.message',
      '.chat-message',
      '.msg-content',
      '.message-content',
      '[class*="message"]',
      '.list-item',
      '.item'
    ];

    for (const selector of selectors) {
      try {
        const count = await page.locator(selector).count();
        if (count > 0) {
          console.log(`选择器 "${selector}" 找到 ${count} 个元素`);

          // 检查前几个元素的文本内容
          for (let i = 0; i < Math.min(3, count); i++) {
            try {
              const text = await page.locator(selector).nth(i).innerText({ timeout: 1000 });
              const classes = await page.locator(selector).nth(i).getAttribute('class');
              console.log(`  元素 ${i + 1}: class="${classes}", text="${text.substring(0, 50)}..."`);
            } catch (e) {
              console.log(`  元素 ${i + 1}: 获取文本失败 - ${e.message}`);
            }
          }
        }
      } catch (e) {
        // 忽略选择器错误
      }
    }

    // 检查页面上的所有文本内容
    try {
      const allText = await page.locator('body').innerText();
      const lines = allText.split('\n').filter(line => line.trim().length > 0);
      console.log(`页面总共有 ${lines.length} 行文本内容`);
      console.log('前10行内容预览:');
      lines.slice(0, 10).forEach((line, i) => {
        console.log(`  ${i + 1}: "${line.substring(0, 80)}"`);
      });
    } catch (e) {
      console.log(`获取页面文本失败: ${e.message}`);
    }

    console.log('=== 调试结束 ===');
  } catch (error) {
    console.log(`调试函数执行失败: ${error.message}`);
  }
}

// 使用鼠标滚轮滚动聊天容器（先点击消息元素，然后在该位置滚轮滑动）
export async function scrollChatContainer(page, deltaY = 500) {
  try {
    // 先找到一个消息元素并点击它
    const messageElement = page.locator(MESSAGE_ITEM_CLASS_NAME).first();

    if (await messageElement.count() === 0) {
      console.log('No message element found to click');
      return false;
    }

    // 点击消息元素
    await messageElement.click();
    console.log('Clicked on message element');

    // 等待一下确保点击生效
    await sleep(500);

    // 获取消息元素的位置
    const messageBox = await messageElement.boundingBox();
    if (!messageBox) {
      console.log('Could not get message element bounding box');
      return false;
    }

    // 在消息元素中心位置执行滚轮滚动
    const centerX = messageBox.x + messageBox.width / 2;
    const centerY = messageBox.y + messageBox.height / 2;

    // 移动鼠标到消息元素中心
    await page.mouse.move(centerX, centerY);

    // 执行滚轮滚动
    await page.mouse.wheel(0, deltaY);

    console.log(`Mouse wheel scrolled by ${deltaY} pixels at position (${centerX}, ${centerY})`);
    await sleep(1000); // 等待内容加载
    return true;
  } catch (error) {
    console.log(`Failed to scroll chat container with mouse wheel: ${error.message}`);
    return false;
  }
}

export async function getMessageList(page) {
  let messageElements = [];
  let foundSelector = '';

  // 尝试各种选择器找到消息元素
  for (const selector of MESSAGE_SELECTORS) {
    try {
      await page.locator(selector).first().waitFor({ timeout: 2000 });
      const count = await page.locator(selector).count();
      if (count > 0) {
        messageElements = await page.locator(selector).all();
        foundSelector = selector;
        console.log(`Found ${count} message elements with selector "${selector}"`);
        break;
      }
    } catch (error) {
      // 继续尝试下一个选择器
    }
  }

  // 如果没找到任何消息元素，运行调试并返回空数组
  if (messageElements.length === 0) {
    console.log('No message elements found with any selector');

    // 调用调试函数帮助找出正确的选择器
    await debugMessageElements(page);

    console.log('Returning empty array due to no message elements found');
    return []; // 如果没有消息元素，返回空数组
  }

  // 过滤出未处理的元素（增量处理）
  const unprocessedElements = [];
  for (const element of messageElements) {
    try {
      const id = await element.getAttribute('id');
      if (id !== 'selected') {
        unprocessedElements.push(element);
      }
    } catch (error) {
      // 如果获取属性失败，假设是未处理的
      unprocessedElements.push(element);
    }
  }

  console.log(`Found ${unprocessedElements.length} unprocessed message elements using selector "${foundSelector}"`);

  // 如果没有未处理的元素，返回空数组
  if (unprocessedElements.length === 0) {
    console.log('No unprocessed message elements found');
    return [];
  }

  console.log(`Found ${unprocessedElements.length} unprocessed message elements using selector "${foundSelector}"`);

  // 限制处理数量，避免一次性处理太多元素导致超时
  const maxProcessCount = 30;
  const messagesToProcess = unprocessedElements.slice(0, maxProcessCount);

  console.log(`Processing ${messagesToProcess.length} messages this time`);

  const pattern = /https:\/\/m\.tb\.cn\/h\.\w+\?tk=\w+/g;

  // 等待所有异步操作完成，获取文本数组
  const textPromises = messagesToProcess.map(async (message, index) => {
    try {
      // 为已处理的元素添加 id 标记
      await message.evaluate((el) => el.id = 'selected');

      // 先等待元素可见，然后获取文本，设置较短的超时时间
      await message.waitFor({ state: 'visible', timeout: 1000 });
      const text = await message.innerText({ timeout: 2000 });
      console.log(`Processed message ${index + 1}/${messagesToProcess.length}: "${text.substring(0, 50)}..."`);
      return text;
    } catch (error) {
      console.log(`Failed to get text for message ${index + 1}: ${error.message}`);
      // 即使获取失败，也标记为已处理，避免下次重复尝试
      await message.evaluate((el) => el.id = 'selected').catch(() => {});
      return ''; // 返回空字符串，后面会被过滤掉
    }
  });
  const texts = await Promise.all(textPromises);

  // 过滤合适长度的文本，然后匹配链接并展平
  const links = texts
    .filter((item) => item.length > 0 && item.length < 200)
    .map(item => {
      const matches = item.trim().match(pattern);
      return matches || []; // 如果没有匹配，返回空数组
    })
    .flat(); // 展平所有匹配结果为一维数组

  return links;
}

// 查找并点击包含指定文本的聊天组
export async function clickChatGroup(page, targetText = "老强说闲鱼互助群") {
  const chatGroups = await page.locator(CHAT_GROUPS_CLASS_NAME).all();

  // 查找包含指定文本的聊天组
  for (const group of chatGroups) {
    try {
      const text = await group.innerText();
      console.log(`Found chat group: "${text}"`);
      if (text.includes(targetText)) {
        console.log(`Found target chat group: "${text}"`);
        await group.click();
        console.log(`Clicked on chat group containing "${targetText}"`);

        // 等待消息区域加载，最多等待10秒
        try {
          await page.locator(MESSAGE_ITEM_CLASS_NAME).first().waitFor({ timeout: 10000 });
          console.log('Message area loaded successfully');
        } catch (error) {
          console.log('Warning: Message area did not load within 10 seconds, but continuing...');
        }

        return group; // 返回找到并点击的组
      }
    } catch (error) {
      console.log(`Error checking group text: ${error.message}`);
      continue;
    }
  }

  console.log(`No chat group found containing "${targetText}"`);
  return null; // 如果没找到匹配的组，返回 null
}