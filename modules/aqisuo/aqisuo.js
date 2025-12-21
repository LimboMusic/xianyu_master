import { getRandomColor } from '../../utils/color.js';
import sharp from 'sharp';
import { sleep } from '../../utils/utils.js';


const CATEGORY_CLASS_NAME = '.title___xowHU.h-24.cursor-pointer.text-14';
const NEXT_BUTTON_CLASS_NAME = '.ant-card-body .bg-white.p-24.border-gray-light.-mx-24 button';
const UPLOAD_IMAGE_CLASS_NAME = 'input[name="files"][type="file"][accept="image/*"]';
const TITLE_INPUT_CLASS_NAME = 'input[placeholder="请输入宝贝标题"]';
const DESCRIPTION_TEXTAREA_CLASS_NAME = 'textarea[placeholder="请输入宝贝描述"]';
const ADDRESS_TEXT_CLASS_NAME = '.ant-space-item .text-14.text-gray-darkest.cursor-pointer';
const PRICE_INPUT_CLASS_NAME = 'input[placeholder="¥0.00"]';
const INVENTORY_INPUT_CLASS_NAME = 'input[id="quantity"]';
const TIMED_PULISH_RADIO_CLASS_NAME = 'input[id="timedPublish"]';
const TIMED_PULISH_INPUT_CLASS_NAME = 'input[placeholder="请选择日期"]';
const OUTER_ID_INPUT_CLASS_NAME = 'input#outerId';
const SERVICE_CHECKBOX_CLASS_NAME = '.antFormItemMb-0 input[type="checkbox"]';
const SUBMIT_BUTTON_CLASS_NAME = '.ant-space-item .ant-btn.css-1x0a6l1.css-var-r0.ant-btn-primary.ant-btn-color-primary.ant-btn-variant-solid';


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
        // await uploadImageLocator.click();
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
        // 注意：setInputFiles 不需要元素可见，但需要元素存在且可交互
        const uploadInputLocator = page.locator(UPLOAD_IMAGE_CLASS_NAME).first();
        
        // 等待元素存在（不需要可见，但需要存在于DOM中）
        try {
            await uploadInputLocator.waitFor({ state: 'attached', timeout: 10000 });
        } catch (error) {
            throw new Error(`文件上传输入框未找到: ${error.message}`);
        }
        
        // 使用 setInputFiles 直接设置文件，不需要点击
        // setInputFiles 可以操作隐藏的文件输入框
        await uploadInputLocator.setInputFiles({
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

export async function fillDescription(page, description) {
    const descriptionTextareaLocator = page.locator(DESCRIPTION_TEXTAREA_CLASS_NAME).first();
    if (await descriptionTextareaLocator.count() === 0) {
        console.log('Description textarea not found', page.url());
        return '';
    }
    await descriptionTextareaLocator.fill(description);
    return;
}

export async function fillAddress(page) {
    const addressTextLocator = page.locator(ADDRESS_TEXT_CLASS_NAME).first();
    if (await addressTextLocator.count() === 0) {
        console.log('Address text not found', page.url());
        return '';
    }
    await addressTextLocator.click();
    return;
}

export async function fillPrice(page, price = '1') {
    const priceInputLocator = page.locator(PRICE_INPUT_CLASS_NAME).first();
    if (await priceInputLocator.count() === 0) {
        console.log('Price input not found', page.url());
        return '';
    }
    await priceInputLocator.fill(price);
    return;
}

export async function fillInventory(page, inventory='9999') {
    const inventoryInputLocator = page.locator(INVENTORY_INPUT_CLASS_NAME).first();
    if (await inventoryInputLocator.count() === 0) {
        console.log('Inventory input not found', page.url());
        return '';
    }
    await inventoryInputLocator.fill(inventory);
    return;
}

export async function fillOuterId(page, outerId) {
    const outerIdInputLocator = page.locator(OUTER_ID_INPUT_CLASS_NAME).first();
    if (await outerIdInputLocator.count() === 0) {
        console.log('Outer id input not found', page.url());
        return '';
    }
    await outerIdInputLocator.fill(String(outerId));
    return;
}

export async function clickServiceCheckboxs(page) {
    const serviceCheckboxLocators = await page.locator(SERVICE_CHECKBOX_CLASS_NAME).all();
    console.log(`Found ${serviceCheckboxLocators.length} service checkboxes`);
    
    if (serviceCheckboxLocators.length === 0) {
        console.log('No service checkboxes found', page.url());
        return;
    }
    
    for (const serviceCheckboxLocator of serviceCheckboxLocators) {
        try {
            await serviceCheckboxLocator.click();
            await sleep(200); // 短暂延迟，避免点击过快
        } catch (error) {
            console.log(`Warning: Failed to click service checkbox: ${error.message}`);
        }
    }
    return;
}

export async function clickTimedPublishRadio(page,date) {
    const timedPublishRadioLocator = await page.locator(TIMED_PULISH_RADIO_CLASS_NAME).first();
    if (await timedPublishRadioLocator.count() === 0) {
        console.log('Timed publish radio not found', page.url());
        return '';
    }
    await timedPublishRadioLocator.click();
    await sleep(1000);
    const timedPublishInputLocator = page.locator(TIMED_PULISH_INPUT_CLASS_NAME).first();
    if (await timedPublishInputLocator.count() === 0) {
        console.log('Timed publish input not found', page.url());
        return '';
    }
    await timedPublishInputLocator.fill(date);
    return;
}

export async function clickSubmitButton(page) {
    const submitButtonLocator = page.locator(SUBMIT_BUTTON_CLASS_NAME).first();
    if (await submitButtonLocator.count() === 0) {
        console.log('Submit button not found', page.url());
        return '';
    }
    await submitButtonLocator.click();
    return;
}