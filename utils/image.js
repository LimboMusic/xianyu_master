import sharp from 'sharp';

// 从网络 URL 下载图片并转换为 Buffer
async function downloadImage(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

async function blurWatermark(inputPath, outputPath) {
    // 判断是否为网络 URL
    let imageBuffer;
    if (inputPath.startsWith('http://') || inputPath.startsWith('https://')) {
        // 从网络下载图片
        imageBuffer = await downloadImage(inputPath);
    } else {
        // 本地文件路径，sharp 可以直接处理
        imageBuffer = null; // 保持原样，让 sharp 直接读取文件
    }
    
    // 创建 sharp 实例
    const image = imageBuffer ? sharp(imageBuffer) : sharp(inputPath);
    const metadata = await image.metadata();
    
    // 定义水印区域（右下角）- 使用固定像素值
    const WATERMARK_WIDTH = 350;  // 水印区域宽度（像素）
    const WATERMARK_HEIGHT = 60;  // 水印区域高度（像素）
    const RIGHT_MARGIN = 10;      // 距离右边缘的边距（像素）
    const BOTTOM_MARGIN = 15;     // 距离底边缘的边距（像素）
    
    // 计算从右下角开始的位置
    const left = Math.max(0, metadata.width - WATERMARK_WIDTH - RIGHT_MARGIN);
    const top = Math.max(0, metadata.height - WATERMARK_HEIGHT - BOTTOM_MARGIN);
    const width = Math.min(WATERMARK_WIDTH, metadata.width - left);
    const height = Math.min(WATERMARK_HEIGHT, metadata.height - top);
    
    // 确保宽度和高度都大于 0
    if (width <= 0 || height <= 0) {
        throw new Error(`Invalid extract area: width=${width}, height=${height}, image size=${metadata.width}x${metadata.height}`);
    }
    
    const region = {
        left,
        top,
        width,
        height
    };

    // 提取该区域并模糊，然后重新合成
    const mask = await image
        .clone()
        .extract(region)
        .blur(10) // 模糊强度
        .toBuffer();

    await image
        .composite([{ input: mask, left: region.left, top: region.top }])
        .toFile(outputPath);
    
    return outputPath;
}

export { blurWatermark };