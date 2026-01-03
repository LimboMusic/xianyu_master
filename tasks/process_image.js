import { blurWatermark } from '../utils/image.js';

const inputPath = 'https://s.coze.cn/t/ULDsB5ThIF0/';
const outputPath = 'output/image.png';

await blurWatermark(inputPath, outputPath);