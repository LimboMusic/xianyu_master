import path from "path";
import { readExcelFile } from "./file.js";

// 从一段文本中提取第一个 URL（同步函数，返回字符串）
export function extractUrlFromText(text) {
  if (!text || typeof text !== "string") return "";

  // 匹配 http 或 https 开头，直到遇到空白字符为止
  const match = text.match(/https?:\/\/\S+/);
  if (!match) return "";

  // 去掉可能结尾带上的中文引号等符号
  return match[0].replace(/[」】）)\u3001\u3002\uff1f\uff01]+$/, "");
}

export async function extractLikeLinks(filter_column_name) {
  // 读取 input/点赞链接.xlsx
  const inputFile = path.resolve("input", "汇总_点赞链接.xlsx");
  console.log(`Reading Excel file: ${inputFile}`);

  let rows = await readExcelFile(inputFile);
  console.log(`Total rows: ${rows.length}`);

  if (filter_column_name) {
    rows = rows.filter(row => row[filter_column_name] !== "是");
  }

  const result = rows.map((row, index) => {
    // 这里列名假设为 “接龙信息”
    const text =
      row["接龙信息"] ??
      row["接龙信息 "] ?? // 兼容可能多一个空格的情况
      "";

    const url = extractUrlFromText(text);
    return {
      rowIndex: index, // Excel 数据行索引（从 0 开始，对应 Excel 第 2 行，因为第 1 行是表头）
      index: index + 1, // 显示用的序号（从 1 开始）
      rawText: text,
      linkUrl: url,
    };
  });

  const withUrl = result.filter((item) => item.linkUrl);

  console.log(`Rows with URL: ${withUrl.length}`);
  console.log("Extracted URLs:");
  console.log(withUrl.map((item) => item.linkUrl));

  return withUrl;
}
