import { createInterface } from 'readline';

async function sleep(ms = 1000) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 阻塞函数，等待用户在控制台输入指定内容后继续
 * @param {string} expectedInput - 期望的用户输入，默认为 '1'
 * @param {string} prompt - 提示信息，默认为 '请输入 1 继续: '
 * @returns {Promise<void>}
 */
async function waitForUserInput(expectedInput = '1', prompt = '请输入 1 继续: ') {
    return new Promise((resolve) => {
        const rl = createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log('\n' + '='.repeat(50));
        console.log('页面已加载完成，等待用户确认...');
        console.log('='.repeat(50));

        const askInput = () => {
            rl.question(prompt, (answer) => {
                if (answer.trim() === expectedInput) {
                    console.log('✓ 确认收到，继续执行...\n');
                    rl.close();
                    resolve();
                } else {
                    console.log(`✗ 输入无效，请输入 "${expectedInput}" 继续`);
                    askInput(); // 递归调用，继续等待正确输入
                }
            });
        };

        askInput();
    });
}

export { sleep, waitForUserInput };