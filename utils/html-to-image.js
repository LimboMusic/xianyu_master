import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 将HTML字符串转换为图片
 * @param {string} htmlContent - HTML内容字符串
 * @param {Object} options - 配置选项
 * @param {string} options.outputPath - 输出图片路径 (可选，默认保存到output目录)
 * @param {string} options.format - 图片格式 ('png' | 'jpeg')，默认 'png'
 * @param {number} options.width - 视口宽度，默认 800
 * @param {number} options.height - 视口高度，默认 600
 * @param {number} options.quality - JPEG质量 (1-100)，仅在format为'jpeg'时有效
 * @param {boolean} options.fullPage - 是否截取完整页面，默认 true
 * @returns {Promise<string>} 返回生成的图片文件路径
 */
export async function htmlToImage(htmlContent, options = {}) {
    const {
        outputPath,
        format = 'png',
        width = 800,
        height = 600,
        quality = 90,
        fullPage = true
    } = options;

    let browser = null;
    let page = null;

    try {
        // 启动浏览器 (headless模式以提高性能)
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            viewport: { width, height }
        });
        page = await context.newPage();

        // 设置HTML内容
        await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });

        // 等待页面完全加载
        await page.waitForLoadState('networkidle');

        // 生成输出路径
        let finalOutputPath;
        if (outputPath) {
            finalOutputPath = outputPath;
        } else {
            // 默认保存到output目录，使用时间戳作为文件名
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const outputDir = path.join(__dirname, '..', 'output');
            finalOutputPath = path.join(outputDir, `html-screenshot-${timestamp}.${format}`);
        }

        // 截图选项
        const screenshotOptions = {
            path: finalOutputPath,
            fullPage,
            type: format
        };

        // 只有在jpeg格式时才设置quality
        if (format === 'jpeg') {
            screenshotOptions.quality = quality;
        }

        // 截取屏幕截图
        await page.screenshot(screenshotOptions);

        console.log(`HTML转图片成功，保存到: ${finalOutputPath}`);
        return finalOutputPath;

    } catch (error) {
        console.error('HTML转图片失败:', error);
        throw error;
    } finally {
        // 清理资源
        if (page) {
            await page.close();
        }
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * 将HTML字符串转换为Base64编码的图片数据
 * @param {string} htmlContent - HTML内容字符串
 * @param {Object} options - 配置选项 (同htmlToImage函数)
 * @returns {Promise<string>} 返回Base64编码的图片数据
 */
export async function htmlToImageBase64(htmlContent, options = {}) {
    const {
        format = 'png',
        width = 800,
        height = 600,
        quality = 90,
        fullPage = true
    } = options;

    let browser = null;
    let page = null;

    try {
        // 启动浏览器
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            viewport: { width, height }
        });
        page = await context.newPage();

        // 设置HTML内容
        await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });

        // 等待页面完全加载
        await page.waitForLoadState('networkidle');

        // 截图选项
        const screenshotOptions = {
            fullPage,
            type: format
        };

        // 只有在jpeg格式时才设置quality
        if (format === 'jpeg') {
            screenshotOptions.quality = quality;
        }

        // 获取截图的buffer数据
        const buffer = await page.screenshot(screenshotOptions);

        // 转换为base64
        const base64 = buffer.toString('base64');
        const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';

        return `data:${mimeType};base64,${base64}`;

    } catch (error) {
        console.error('HTML转Base64图片失败:', error);
        throw error;
    } finally {
        // 清理资源
        if (page) {
            await page.close();
        }
        if (browser) {
            await browser.close();
        }
    }
}
