import { htmlToImage, htmlToImageBase64 } from './utils/html-to-image.js';
import { readFileSync } from 'fs';
import path from 'path';

// 示例1: 将HTML字符串直接转换为图片
async function example1() {
    console.log('=== 示例1: HTML字符串转图片文件 ===');

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {
                font-family: Arial, sans-serif;
                background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
                color: white;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
            }
            .card {
                background: rgba(255, 255, 255, 0.1);
                padding: 20px;
                border-radius: 10px;
                text-align: center;
                backdrop-filter: blur(10px);
            }
            h1 { margin: 0 0 10px 0; }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>Hello World!</h1>
            <p>这是HTML转图片的示例</p>
        </div>
    </body>
    </html>`;

    try {
        const imagePath = await htmlToImage(htmlContent, {
            format: 'png',
            width: 800,
            height: 400,
            fullPage: false
        });
        console.log(`图片已保存到: ${imagePath}`);
    } catch (error) {
        console.error('转换失败:', error);
    }
}

// 示例2: 读取HTML文件并转换为图片
async function example2() {
    console.log('\n=== 示例2: HTML文件转图片 ===');

    try {
        // 读取modules/image/index.html文件
        const htmlFilePath = path.join(process.cwd(), 'modules', 'image', 'index.html');
        const htmlContent = readFileSync(htmlFilePath, 'utf-8');

        const imagePath = await htmlToImage(htmlContent, {
            format: 'png',
            width: 400,  // 根据HTML内容调整尺寸
            height: 400,
            fullPage: false
        });
        console.log(`HTML文件转图片成功，保存到: ${imagePath}`);
    } catch (error) {
        console.error('转换失败:', error);
    }
}

// 示例3: 将HTML转换为Base64编码的图片数据
async function example3() {
    console.log('\n=== 示例3: HTML转Base64图片数据 ===');

    const simpleHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {
                background: #f0f0f0;
                font-family: Arial, sans-serif;
                padding: 20px;
            }
            .box {
                background: white;
                padding: 15px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
        </style>
    </head>
    <body>
        <div class="box">
            <h2>Base64图片示例</h2>
            <p>这个HTML内容被转换为Base64编码的图片数据</p>
        </div>
    </body>
    </html>`;

    try {
        const base64Data = await htmlToImageBase64(simpleHtml, {
            format: 'png',
            width: 600,
            height: 300,
            fullPage: false
        });
        console.log(`Base64图片数据长度: ${base64Data.length} 字符`);
        console.log(`Base64数据预览: ${base64Data.substring(0, 50)}...`);

        // 可以在这里使用base64Data，比如保存到文件或发送到API
    } catch (error) {
        console.error('转换失败:', error);
    }
}

// 运行所有示例
async function runAllExamples() {
    await example1();
    await example2();
    await example3();
    console.log('\n=== 所有示例完成 ===');
}

// 直接运行示例
runAllExamples();

export { example1, example2, example3 };
