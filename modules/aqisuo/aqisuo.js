import { getRandomColor } from '../../utils/color.js';
import sharp from 'sharp';


const CATEGORY_CLASS_NAME = '.title___xowHU.h-24.cursor-pointer.text-14';
const NEXT_BUTTON_CLASS_NAME = '.ant-card-body .bg-white.p-24.border-gray-light.-mx-24 button';
const UPLOAD_IMAGE_CLASS_NAME = 'input[name="files"][type="file"][accept="image/*"]';
const TITLE_INPUT_CLASS_NAME = 'input[placeholder="请输入宝贝标题"]';
const DESCRIPTION_TEXTAREA_CLASS_NAME = 'textarea[placeholder="请输入宝贝描述"]';
const ADDRESS_TEXT_CLASS_NAME = '.ant-space-item .text-14.text-gray-darkest.cursor-pointer';
const PRICE_INPUT_CLASS_NAME = 'input[placeholder="¥0.00"]';


export async function selectCategory(page) {
    const color = getRandomColor();
    const categoryLocator = page.locator(CATEGORY_CLASS_NAME).first();

    // 如果没找到元素就跳过背景色设置
    if (await categoryLocator.count() > 0) {
        await categoryLocator.evaluate((element, color) => {
            element.style.backgroundColor = color;
        }, color);
    }

    const categoryElement = categoryLocator;
    if (await categoryElement.count() === 0) {
        console.log('Category element not found', page.url());
        return '';
    }

    await categoryElement.click();
    return;
}

export async function clickNextButton(page) {
    const nextButtonLocator = page.locator(NEXT_BUTTON_CLASS_NAME).first();
    if (await nextButtonLocator.count() === 0) {
        console.log('Next button not found', page.url());
        return '';
    }
    await nextButtonLocator.click();
    return;
}

export async function uploadImage(page, imageUrl = null) {
    if (!imageUrl) {
        // 如果没有提供图片URL，只点击上传按钮
        const uploadImageLocator = page.locator(UPLOAD_IMAGE_CLASS_NAME).first();
        if (await uploadImageLocator.count() === 0) {
            console.log('Upload image input not found', page.url());
            return '';
        }
        await uploadImageLocator.click();
        return;
    }

    try {
        // 处理URL，确保它是完整的URL
        let fullUrl = imageUrl;
        if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
            // 如果是相对URL，自动添加https协议
            fullUrl = 'https://' + imageUrl;
        }

        // 使用 Playwright 上下文的 request 来下载图片，这样可以利用当前的 Cookie/Session 状态
        const response = await page.request.get(fullUrl);

        if (!response.ok()) {
            throw new Error(`无法下载图片: ${response.status()} - ${response.statusText()}`);
        }

        let imageBuffer = await response.body();

        // 获取图片的文件扩展名，如果URL中没有扩展名则默认为png
        const urlParts = imageUrl.split('.');
        let extension = urlParts.length > 1 ? urlParts[urlParts.length - 1].split('?')[0] : 'png';

        // 如果是webp格式，转换为png
        if (extension.toLowerCase() === 'webp') {
            console.log('检测到webp格式，正在转换为png...');
            imageBuffer = await sharp(imageBuffer).png().toBuffer();
            extension = 'png';
            console.log('webp已转换为png格式');
        }

        const mimeType = 'image/png'; // 统一使用png格式

        // 将 Buffer 数据上传到文件输入框
        // setInputFiles 支持传入一个对象数组，包含 buffer, name, mimeType
        await page.locator(UPLOAD_IMAGE_CLASS_NAME).setInputFiles({
            name: `downloaded-image.${extension}`, // 模拟的文件名
            mimeType: mimeType,                     // 文件类型
            buffer: imageBuffer                      // 二进制数据
        });

        console.log(`图片已成功上传! URL: ${imageUrl}, 类型: ${mimeType}`);
    } catch (error) {
        console.error('上传过程中出错:', error);
        throw error;
    }
}

export async function fillTitle(page, title) {
    const titleInputLocator = page.locator(TITLE_INPUT_CLASS_NAME).first();
    if (await titleInputLocator.count() === 0) {
        console.log('Title input not found', page.url());
        return '';
    }
    await titleInputLocator.fill(title);
    return;
}