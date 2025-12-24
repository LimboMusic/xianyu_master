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
                    uniqueMap.set(item[id], item);
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

/*
    更新 Excel 文件中指定行的某个列的值
    filename: Excel 文件路径
    rowIndex: 行索引（从 0 开始，0 是表头，1 是第一条数据）
    columnName: 列名
    value: 要设置的值
*/
export async function updateExcelCell(filename, rowIndex, columnName, value) {
    try {
        const fileBuffer = fs.readFileSync(filename);
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // 将 sheet 转换为 JSON 数组
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        
        // 找到列名对应的列索引
        const headerRow = data[0];
        const columnIndex = headerRow.findIndex(col => col === columnName || col === columnName.trim());
        
        if (columnIndex === -1) {
            console.log(`Column "${columnName}" not found in Excel file`);
            return false;
        }
        
        // 更新指定行的值（rowIndex + 1 因为第一行是表头）
        const targetRowIndex = rowIndex + 1;
        if (targetRowIndex >= data.length) {
            // 如果行不存在，需要扩展数组
            while (data.length <= targetRowIndex) {
                data.push([]);
            }
        }
        
        // 确保该行有足够的列
        while (data[targetRowIndex].length <= columnIndex) {
            data[targetRowIndex].push('');
        }
        
        data[targetRowIndex][columnIndex] = value;
        
        // 将更新后的数据写回 sheet
        const newSheet = XLSX.utils.aoa_to_sheet(data);
        workbook.Sheets[sheetName] = newSheet;
        
        // 保存文件
        XLSX.writeFile(workbook, filename);
        console.log(`Updated Excel: row ${targetRowIndex}, column "${columnName}" = "${value}"`);
        return true;
    } catch (error) {
        console.error(`Failed to update Excel cell: ${error.message}`);
        return false;
    }
}