import { sleep } from "../../utils/utils.js";

const CHAT_BOX_CLASS_NAME = "textarea[placeholder='请输入消息，按Enter键发送或点击发送按钮发送']";
const CHAT_RED_POINT_CLASS_NAME = ".conversation-item--JReyg97P .ant-scroll-number.ant-badge-count.ant-badge-count-sm";
const CHAT_HEAD_TEXT_CLASS_NAME = ".container--dgZTBkgv";
const MESSAGE_CLASS_NAME = ".ant-list-items >div";
const MESSAGE_LIST_LENGTH_CLASS_NAME = ".conv-header--XMpaBljN >div:nth-child(1)";
const MESSAGE_LIST_CONTAINER_CLASS_NAME = ".rc-virtual-list-holder-inner";
const SCROLLBAR_THUMB_CLASS_NAME = ".rc-virtual-list-scrollbar-thumb";


async function sendMessage(page, message = 'zhi顶，谢谢啦') {
    const chatBoxLocator = page.locator(CHAT_BOX_CLASS_NAME).first();
    if ((await chatBoxLocator.count({ timeout: 5000 })) > 0) {
        await chatBoxLocator.fill(message, { timeout: 5000 });
        await chatBoxLocator.press("Enter", { timeout: 5000 });
        await sleep(1000);
    } else {
        console.log("Chat box not found");
    }
}

async function clickChatRedPoint(page) {
    const chatRedPointCount = page.locator(CHAT_RED_POINT_CLASS_NAME).count();
    const chatRedPointLocator = page.locator(CHAT_RED_POINT_CLASS_NAME).first();
    if ((await chatRedPointLocator.count()) > 0) {
        await chatRedPointLocator.click();;
    }
    return chatRedPointCount;
}

async function getChatHeadText(page) {
    const chatHeadTextLocator = page.locator(CHAT_HEAD_TEXT_CLASS_NAME).first();
    try {
        await chatHeadTextLocator.waitFor({ timeout: 10000 });
        return await chatHeadTextLocator.innerText();
    } catch (error) {
        return "";
    }
}

async function getChatMessageListLength(page) {
    const messageListLocators = page.locator(MESSAGE_CLASS_NAME);
    return await messageListLocators.count();
}
async function getMessageListLength(page) {
    const messageListLengthLocator = await page.locator(MESSAGE_LIST_LENGTH_CLASS_NAME).first();

    const text = await messageListLengthLocator.innerText();

    // 先用正则表达式提取数字，然后再转换为整数
    const match = text.match(/(\d+)/);
    return match ? parseInt(match[0]) : 0;
}


async function scrollVirtualListByWheel(page, scrollDistance = null) {
    try {
        const containerLocator = page.locator(MESSAGE_LIST_CONTAINER_CLASS_NAME).first();

        // 先点击容器内部激活它
        await containerLocator.click();

        // 等待一下确保激活
        await sleep(1000);

        const containerBox = await containerLocator.boundingBox();

        if (containerBox) {
            const centerX = containerBox.x + containerBox.width / 2;
            const centerY = containerBox.y + containerBox.height / 2;

            // 如果没有指定滚动距离，使用容器高度作为默认滚动距离
            const actualScrollDistance = scrollDistance !== null ? scrollDistance : containerBox.height;

            await page.mouse.move(centerX, centerY);
            await page.mouse.wheel(0, actualScrollDistance);
            await sleep(200);

            console.log(`Virtual list scrolled by wheel with deltaY: ${actualScrollDistance} (container height: ${containerBox.height})`);
            await sleep(1000); // 等待内容加载
            return true;
        } else {
            throw new Error('Could not get container bounding box');
        }
    } catch (error) {
        console.log(`Wheel scroll failed: ${error.message}`);
        return false;
    }
}

async function scrollDownMessageList(page, distance = 1000, maxRetries = 3) {
    return await scrollVirtualListByWheel(page, null);
}

export {
    sendMessage,
    clickChatRedPoint,
    getChatHeadText,
    getChatMessageListLength,
    getMessageListLength,
    scrollVirtualListByWheel,
    scrollDownMessageList,
};