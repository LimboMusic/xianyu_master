import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

/*
    data: 数据，数组
    filename: 文件名
    id: 去重id，默认是linkUrl
*/
export async function exportToExcelFile(data, filename, id = 'linkUrl') {
    let finalData = [...data];

    // 如果文件存在，读取现有数据并合并
    if (fs.existsSync(filename)) {
        try {
            const existingData = await readExcelFile(filename);
            console.log(`Found existing file with ${existingData.length} rows`);

            // 合并数据
            finalData = [...existingData, ...data];

            // 根据linkUrl去重，保留最新的数据（新数据覆盖旧数据）
            const uniqueMap = new Map();
            finalData.forEach(item => {
                if (item[id]) {
                    uniqueMap.set(item.linkUrl, item);
                } else {
                    // 如果没有linkUrl，使用完整对象作为key（不太可能去重）
                    uniqueMap.set(JSON.stringify(item), item);
                }
            });

            finalData = Array.from(uniqueMap.values());
            console.log(`After deduplication: ${finalData.length} unique rows`);
        } catch (error) {
            console.log(`Warning: Failed to read existing file ${filename}: ${error.message}`);
            console.log('Proceeding with new data only');
        }
    }

    const ws = XLSX.utils.json_to_sheet(finalData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

    // 如果目录不存在就创建
    const dir = path.dirname(filename);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    XLSX.writeFile(wb, filename);
    console.log(`Exported ${finalData.length} rows to ${filename}`);
}

export async function readExcelFile(filename) {
    const fileBuffer = fs.readFileSync(filename);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: true });
    return data;
}