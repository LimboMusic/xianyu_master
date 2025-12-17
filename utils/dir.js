import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 安全地创建目录（支持顶层调用）
 * @param {string} dirPath - 目录路径（相对或绝对）
 * @param {boolean} useAbsolutePath - 是否使用绝对路径，默认 true
 * @returns {string} 创建的目录的绝对路径
 */
export function ensureDir(dirPath, useAbsolutePath = true) {
    try {
        let finalPath = dirPath;
        
        // 如果使用绝对路径，转换为绝对路径
        if (useAbsolutePath && !path.isAbsolute(dirPath)) {
            finalPath = path.join(__dirname, '..', dirPath);
        }
        
        // 使用递归创建
        fs.mkdirSync(finalPath, { recursive: true });
        return finalPath;
    } catch (error) {
        // 如果失败，尝试逐级创建
        try {
            const parts = (useAbsolutePath && !path.isAbsolute(dirPath) 
                ? path.join(__dirname, '..', dirPath) 
                : dirPath).split(path.sep);
            
            let currentPath = '';
            for (const part of parts) {
                if (part) {
                    currentPath = currentPath ? path.join(currentPath, part) : part;
                    if (!fs.existsSync(currentPath)) {
                        fs.mkdirSync(currentPath);
                    }
                }
            }
            return currentPath;
        } catch (fallbackError) {
            console.error(`Failed to create directory ${dirPath}: ${fallbackError.message}`);
            throw fallbackError;
        }
    }
}

/**
 * 延迟创建目录（使用 process.nextTick）
 * @param {string} dirPath - 目录路径
 * @param {boolean} useAbsolutePath - 是否使用绝对路径
 * @returns {Promise<string>} 创建的目录的绝对路径
 */
export function ensureDirAsync(dirPath, useAbsolutePath = true) {
    return new Promise((resolve, reject) => {
        process.nextTick(() => {
            try {
                const result = ensureDir(dirPath, useAbsolutePath);
                resolve(result);
            } catch (error) {
                reject(error);
            }
        });
    });
}

