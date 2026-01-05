import { sleep } from "../../utils/utils.js";

const RESPONSE_CLASS_NAME = 'code'
const DIALOG_CONFIRM_BUTTON_CLASS_NAME = 'div[role="alertdialog"] button:nth-child(2)'

const LINK_PRODUCTION_PROMPT = `请扮演一个闲鱼虚拟资料爆款文案优化专家，基于我提供的对标文案，完成以下四项任务：

1. **标题优化**：
   - 保留核心关键词，但升级为更具吸引力的表述
   - 长度控制在30个字符以内
   - 突出产品的核心价值和独特卖点
   - 使用数字量化产品的价值
   - 直接承诺用户可以获得的利益
   - 格式为JSON的title字段
   - 不要带表情，只有文字

2. **内容重构**：
   - 将对标文案中的功能点转化为可感知的利益点
   - 合并重复项，提升信息密度
   - 保持原有的免责声明信息
   - 格式为JSON的content字段
   - 使用✅符号将产品的卖点分点列出
   - 每一点之间用'\\n'换行符分割
   - 将产品的功能与具体的使用场景相结合
   - 提供信任背书和风险降低的服务承诺

3. **图片生成**：
   - 提供对标图片的URL
   - 生成一张清晰度更高更突出卖点更吸引人点击的PNG格式图片
   - 只提供生成的图片的网址，格式为JSON的img_url字段
   - 图片中突出展示产品的核心卖点
   - 图片的风格与产品的定位和目标受众相匹配

4. **id生成**
  - 最后生成一个id，与我提供的id一一对应
  - 格式为JSON的id字段
  
请直接输出最终结果，用代码框包裹，不需要解释优化过程。

`

const gotoCoZiPage = async (page, url = 'https://space.coze.cn/task/7590320827037368639') => {
    const newPage = await page.goto(url);
    await sleep(1000);
    return newPage;
}

const inputPrompt = async (page, prompt) => {
    // 点击.cm-editor元素以激活输入区域（使用.last()获取最后一个，通常是输入框）
    const editorElement = await page.locator('.cm-editor').last();
    await editorElement.click();
    await sleep(500);

    // 先清除编辑器内容（如果有的话）
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Delete');
    await sleep(200);

    // 使用复制粘贴方式输入整个prompt，避免键盘输入触发自动发送
    const fullPrompt = LINK_PRODUCTION_PROMPT + prompt;

    // 将文本复制到剪贴板
    await page.evaluate(async (text) => {
        await navigator.clipboard.writeText(text);
    }, fullPrompt);

    await sleep(200);

    // 粘贴文本
    await page.keyboard.press('Control+v');
    await sleep(1000);

    // 手动点击发送按钮
    const sendButton = await page.locator('.rounded-xl.w-full.p-4.pt-0 button[data-slot="tooltip-trigger"]').last();
    await sendButton.click();
    await sleep(1000);
}

const getResponseJson = async (page, id, interval = 3000) => {
    let obj = { id: '' };
    let attempts = 0;
    const maxAttempts = 30; // 最多尝试30次

    // 将目标ID转换为字符串，用于比较
    const targetIdStr = String(id);
    while (String(obj.id) !== targetIdStr && attempts < maxAttempts) {
        attempts++;
        console.log(`Waiting for response ${id} (attempt ${attempts}/${maxAttempts})`);

        // 优先寻找classname为lines-content的元素，如果没有再寻找code元素
        let responseElement;
        try {
            responseElement = await page.locator('.lines-content').last();
            await responseElement.waitFor({ timeout: 5000 });
        } catch (e) {
            console.log('lines-content元素未找到，尝试寻找code元素');
            responseElement = await page.locator('code').last();
            await responseElement.waitFor({ timeout: 10000 });
        }

        // 获取innerText
        let responseText = await responseElement.innerText();
        console.log('Raw response text:', responseText);

        // 如果响应为空，继续等待
        if (!responseText || responseText.trim() === '') {
            console.log('Response text is empty, waiting...');
            await sleep(interval);
            continue;
        }

        try {
            // 清理文本：移除可能的markdown代码块标记和多余的换行符
            responseText = responseText
                .trim()  // 移除开头和结尾的空白字符
                .replace(/^```\w*\n?/, '')  // 移除开头的markdown代码块标记
                .replace(/\n?```$/, '')     // 移除结尾的markdown代码块标记
                .replace(/^{\\n/, '{')       // 移除开头的{\n
                .replace(/\\n}$/, '}')       // 移除结尾的\n}
                .replace(/\\n/g, '')         // 移除所有的\n（因为它们破坏了JSON格式）
                .replace(/\\t/g, '')         // 移除制表符
                .replace(/\\r/g, '');        // 移除回车符

            console.log('Cleaned response text:', responseText);
            obj = JSON.parse(responseText);

            // 检查是否是我们要找的ID（统一转换为字符串进行比较，避免类型不匹配）
            const objIdStr = String(obj.id);
            if (objIdStr === targetIdStr) {
                console.log(`Response found ${obj.id}`);
                break;
            } else {
                console.log(`Found response with id ${obj.id} (type: ${typeof obj.id}), but waiting for ${id} (type: ${typeof id})`);
                await sleep(interval);
            }
        } catch (e) {
            console.log('JSON parse error:', e.message);
            console.log('Failed text:', responseText);
            // 如果解析失败，继续等待（可能是响应还没完全加载）
            await sleep(interval);
        }
    }

    if (attempts >= maxAttempts) {
        throw new Error(`Timeout: Could not find response with id ${id} after ${maxAttempts} attempts`);
    }

    console.log(`Final Response: ${JSON.stringify(obj, null, 2)}`);
    return obj
}

const clickDialogConfirmButton = async (page) => {
    try {
        const dialogConfirmButton = await page.locator(DIALOG_CONFIRM_BUTTON_CLASS_NAME).first();
        await dialogConfirmButton.waitFor({ timeout: 5000 });
        if (await dialogConfirmButton.count() > 0) {
            await dialogConfirmButton.click();
            console.log('点击确认按钮');
            await sleep(1000);
        } else {
            console.log('确认按钮未找到');
        }
    } catch (error) {
        console.log('确认按钮未找到或点击失败，继续执行:', error.message);
    }
}

export { gotoCoZiPage, inputPrompt, getResponseJson, clickDialogConfirmButton };