import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dayjs from 'dayjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORE_FILE = path.join(__dirname, 'publish_records.json');

const INTERVAL_TIME = 5; // 间隔时间，单位：小时

/**
 * 读取存储文件
 * @returns {Object} 存储的数据
 */
function readStore() {
    try {
        if (fs.existsSync(STORE_FILE)) {
            const content = fs.readFileSync(STORE_FILE, 'utf-8');
            return JSON.parse(content);
        }
    } catch (error) {
        console.error(`Error reading store file: ${error.message}`);
    }
    return { 
        records: [],           // 已发布的记录
        lastPublishTime: null  // 最后一次发布时间
    };
}

/**
 * 写入存储文件
 * @param {Object} data - 要写入的数据
 */
function writeStore(data) {
    try {
        // 确保目录存在
        const dir = path.dirname(STORE_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error(`Error writing store file: ${error.message}`);
    }
}

/**
 * 获取指定日期已发布的次数
 * @param {string} date - 日期字符串，格式 YYYY-MM-DD
 * @returns {number} 指定日期已发布的次数
 */
function getDateCount(date) {
    const store = readStore();
    const dateRecords = store.records.filter(record => record.date === date);
    return dateRecords.length;
}

/**
 * 获取最后一次发布时间
 * @returns {string|null} 最后一次发布时间，格式 YYYY-MM-DD HH:mm:ss，如果没有则返回null
 */
export function getLastPublishTime() {
    const store = readStore();
    return store.lastPublishTime || null;
}

/**
 * 获取最后一次发布的日期
 * @returns {string|null} 最后一次发布的日期，格式 YYYY-MM-DD
 */
export function getLastPublishDate() {
    const lastTime = getLastPublishTime();
    if (!lastTime) return null;
    return dayjs(lastTime).format('YYYY-MM-DD');
}

/**
 * 计算下一个定时发布时间
 * - 基准时间 base：有 lastPublishTime 且其晚于当前时刻 → 用 lastPublishTime；否则（无记录、或已早于/等于现在）→ 用当前时刻
 * - 下次发布时间 = base + INTERVAL_TIME（小时）
 * @returns {{ date: string, time: string, timestamp: number }}
 */
export function getNextPublishTime() {
    const store = readStore();
    const now = dayjs();

    const last = store.lastPublishTime ? dayjs(store.lastPublishTime) : null;
    const base = last && last.isAfter(now) ? last : now;
    const nextTime = base.add(INTERVAL_TIME, 'hour');

    return {
        date: nextTime.format('YYYY-MM-DD'),
        time: nextTime.format('YYYY-MM-DD HH:mm:ss'),
        timestamp: nextTime.valueOf()
    };
}

/**
 * 记录一次发布
 * @param {Object} publishInfo - 发布信息对象
 * @param {string} publishInfo.actualTime - 实际发布时间，默认为当前时间
 * @param {string} publishInfo.scheduledTime - 定时发布时间，默认为实际发布时间
 * @returns {boolean} 是否成功记录
 */
export function recordPublish(publishInfo = {}) {
    const now = dayjs();
    const actualTime = publishInfo.actualTime ? dayjs(publishInfo.actualTime) : now;
    const scheduledTime = publishInfo.scheduledTime ? dayjs(publishInfo.scheduledTime) : actualTime;
    
    const record = {
        date: actualTime.format('YYYY-MM-DD'),
        actualTime: actualTime.format('YYYY-MM-DD HH:mm:ss'),
        scheduledTime: scheduledTime.format('YYYY-MM-DD HH:mm:ss'),
        actualTimestamp: actualTime.valueOf(),
        scheduledTimestamp: scheduledTime.valueOf()
    };
    
    const store = readStore();
    
    // 添加新记录
    store.records.push(record);
    
    // 更新最后一次发布时间
    store.lastPublishTime = scheduledTime.format('YYYY-MM-DD HH:mm:ss');
    
    // 按时间戳排序（最新的在前）
    store.records.sort((a, b) => (b.actualTimestamp || 0) - (a.actualTimestamp || 0));
    
    writeStore(store);
    
    return true;
}

/**
 * 获取今天已记录的安排次数（仅统计，无上限）
 * @returns {number}
 */
export function getTodayCount() {
    const today = dayjs().format('YYYY-MM-DD');
    return getDateCount(today);
}

/**
 * 获取今天的发布记录
 * @returns {Array} 今天的发布记录数组
 */
export function getTodayRecords() {
    const store = readStore();
    const today = dayjs().format('YYYY-MM-DD');
    
    return store.records.filter(record => record.date === today);
}

/**
 * 获取所有记录（用于调试）
 * @returns {Array} 所有记录
 */
export function getAllRecords() {
    const store = readStore();
    return store.records;
}

/**
 * 获取指定日期的发布记录
 * @param {string} date - 日期字符串，格式 YYYY-MM-DD
 * @returns {Array} 指定日期的发布记录数组
 */
export function getDateRecords(date) {
    const store = readStore();
    return store.records.filter(record => record.date === date);
}
