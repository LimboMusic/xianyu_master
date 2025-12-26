import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dayjs from 'dayjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORE_FILE = path.join(__dirname, 'publish_records.json');
const DAILY_LIMIT = 7; // 每天最多上传次数

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
 * 计算下一个发布时间
 * 基于最后一次发布时间，如果今天还没发够5条就在今天发，否则往后推
 * @returns {Object} 包含发布时间和日期的对象
 */
export function getNextPublishTime() {
    const store = readStore();
    const now = dayjs().add(15,'minutes');
    const today = now.format('YYYY-MM-DD');
    
    // 如果没有发布记录，从今天开始，延迟2小时
    if (!store.lastPublishTime) {
        const firstPublishTime = now.add(2, 'hour').format('YYYY-MM-DD HH:mm:ss');
        return {
            date: today,
            time: firstPublishTime,
            timestamp: now.valueOf()
        };
    }

    // 如果最后一次发布时间早于当前时间，则返回当前时间
    if (dayjs(store.lastPublishTime).isBefore(now)) {
        return {
            date: today,
            time: now.add(15,'minute').format('YYYY-MM-DD HH:mm:ss'),
            timestamp: now.add(15,'minute').valueOf()
        };
    }
    
    // 获取最后一次发布的日期
    const lastPublishDate = dayjs(store.lastPublishTime).format('YYYY-MM-DD');
    const todayCount = getDateCount(today);
    
    // 如果今天还没发够5条，就在今天发布
    if (todayCount < DAILY_LIMIT) {
        // 计算今天下一个发布时间（距离上次发布至少间隔一段时间）
        const lastTime = dayjs(store.lastPublishTime);
        let nextTime = now.add(15,'minute');
        
        // 如果最后一次发布是今天，至少间隔2小时
        if (lastPublishDate === today) {
            nextTime = lastTime.add(2, 'hour');
        }
        
        return {
            date: today,
            time: nextTime.format('YYYY-MM-DD HH:mm:ss'),
            timestamp: nextTime.valueOf()
        };
    }
    
    // 如果今天已经发够5条，从明天开始
    let nextDate = dayjs().add(1, 'day');
    let nextTime = nextDate.hour(9).minute(0).second(0); // 默认明天早上9点
    
    // 如果最后一次发布是今天，从明天开始
    // 如果最后一次发布是更早的日期，检查那个日期是否还有剩余次数
    if (lastPublishDate !== today) {
        const lastDateCount = getDateCount(lastPublishDate);
        if (lastDateCount < DAILY_LIMIT) {
            // 如果最后一次发布的日期还有剩余次数，继续在那个日期发布
            nextDate = dayjs(lastPublishDate);
            const lastTime = dayjs(store.lastPublishTime);
            nextTime = lastTime.add(2, 'hour');
            // 如果计算出的时间已经过了，就用当前时间
            if (nextTime.isBefore(now)) {
                nextTime = now;
            }
        }
    }
    
    return {
        date: nextDate.format('YYYY-MM-DD'),
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
 * 获取今天已发布的次数
 * @returns {number} 今天已发布的次数
 */
export function getTodayCount() {
    const today = dayjs().format('YYYY-MM-DD');
    return getDateCount(today);
}

/**
 * 检查今天是否还能发布
 * @returns {boolean} true表示可以发布，false表示已达到限制
 */
export function canPublishToday() {
    const todayCount = getTodayCount();
    return todayCount < DAILY_LIMIT;
}

/**
 * 获取今天的剩余发布次数
 * @returns {number} 剩余次数
 */
export function getTodayRemainingCount() {
    const todayCount = getTodayCount();
    return Math.max(0, DAILY_LIMIT - todayCount);
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
