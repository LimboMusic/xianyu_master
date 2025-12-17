import { Browser } from '../utils/browser.js';
import { selectCategory, clickNextButton, uploadImage, fillTitle, fillDescription, fillAddress, fillPrice, fillInventory, clickTimedPublishRadio, fillOuterId, clickServiceCheckboxs, clickSubmitButton } from '../modules/aqisuo/aqisuo.js';
import { sleep, waitForUserInput } from '../utils/utils.js';
import dayjs from 'dayjs';


const str = `（秒发货）D01 精选999套高级PPT模板｜屎盆子镶金边｜国赛金奖｜设计感｜莫兰迪

——★24小时自动发货★——

精选999套精选ppt高端模板 古风模板
包含但不限于：
【莫兰迪风】➕【设计感】➕【轻奢大理石】➕【手绘风】➕【极简禁欲】➕【文艺旅行】➕【纯粹简致】➕【国潮风】➕【中国风】➕【北欧风】➕【ins风】➕【欧美风格】➕【高级极简】➕【日系】➕【屎盆子镶金边】附赠【精选合集】
工作总结｜工作汇报｜数据分析｜市场调研｜答辩｜授课｜竞赛｜大学生｜教师｜
[火]每套风格的模版都是我精心挑选出来的～

[火]拍下后赠送 "山海大气"工作总结ppt模板

[火]每款精选质量高，适用于任何场合～

[火]每个风格都有单独归类文档编号～

[火]随时可拍，随时秒发货，着急的可以提前下～

[号外]点击“直接刀成”无需等待，自动秒发

网盘发货
`
const browser = new Browser();

// 设置为 true 表示连接到手动打开的浏览器，false 表示启动新浏览器
const USE_EXISTING_BROWSER = true; // 修改这个变量来选择模式

// Windows 启动命令（推荐使用 IPv4 地址）：
// 方法1: 使用 start_chrome.bat 脚本（推荐）
// 方法2: 手动启动 Chrome（Chrome 实际位置）：
// "C:\Users\18176\AppData\Local\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1
// 
// 如果 Chrome 在其他位置，常见位置：
// - C:\Program Files\Google\Chrome\Application\chrome.exe
// - C:\Program Files (x86)\Google\Chrome\Application\chrome.exe
// - C:\Users\<用户名>\AppData\Local\Google\Chrome\Application\chrome.exe
//
// 验证浏览器是否启动：访问 http://127.0.0.1:9222/json/version 查看是否返回数据

async function publishLinks() {
    if (USE_EXISTING_BROWSER) {
        await browser.connectToExistingBrowser();
    } else {
        await browser.launchBrowser();
    }

    const page = await browser.navigateWithRetry('https://aldsidle.agiso.com/#/goodsManage/goodsList/goodsRelease');
    await page.waitForLoadState('networkidle');

    await sleep(1000);
    // 等待关闭按钮出现并点击
    try {
        await page.waitForSelector('span[aria-label="close-circle"]', { timeout: 2000 });
        await page.locator('span[aria-label="close-circle"]').first().click();
    } catch (error) {
        console.log(`Warning: Close button not found or failed to click: ${error.message}`);
    }
    await sleep(1000);
    await selectCategory(page);
    await sleep(2000)
    await clickNextButton(page);
    await sleep(2000)
    await uploadImage(page, 'img.alicdn.com/bao/uploaded/i1/O1CN010Z7GQE1gSAmewYzmH_!!4611686018427384892-53-fleamarket.heic_790x10000Q90.jpg_.webp');
    await fillTitle(page,str.slice(0, 30));
    await fillDescription(page, str);
    await fillAddress(page);
    await fillPrice(page);
    await fillInventory(page);
    await clickTimedPublishRadio(page, dayjs().add(1, 'day').format('YYYY-MM-DD HH:mm:ss'));
    await fillOuterId(page, '1');
    await clickServiceCheckboxs(page);
    await clickSubmitButton(page);
    await sleep(2000);
    try{
        await page.waitForSelector('.ant-modal-footer button', { timeout: 5000 });
        await page.locator('.ant-modal-footer button').last().click();
    } catch (error) {
        console.log(`Warning: Close button not found or failed to click: ${error.message}`);
    }
    // await page.waitForSelector('.ant-modal-close', { timeout: 5000 });
    // await page.locator('.ant-modal-close').first().click();
}

for(let i = 0; i < 10; i++) {
    await publishLinks();
    await sleep(2000);
}