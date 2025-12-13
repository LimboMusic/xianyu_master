import inquirer from 'inquirer';
import { spawn } from 'child_process';
import path from 'path';

// --- 配置你的脚本列表 ---
// name: 终端显示的文字
// value: 对应的文件路径 (相对于项目根目录)
const scripts = [
  { 
    name: '搜索店铺里的所有链接', 
    value: './tasks/search_shop_links.js' 
  },
  { 
    name: '获取店铺想要数据', 
    value: './tasks/get_shop_review_data.js' 
  }
];

// --- 主逻辑 ---
try {
  console.clear(); //以此清除之前的控制台信息，界面更清爽
  console.log('🤖 自动化任务控制台 \n');

  // 1. 启动菜单
  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'targetFile',
      message: '请选择要执行的任务:',
      choices: scripts,
      pageSize: 10
    }
  ]);

  const scriptPath = answer.targetFile;
  
  console.log(`\n🚀 正在启动: ${scriptPath} ...\n`);
  console.log('--------------------------------------------------');

  // 2. 执行 Node 命令
  // 使用 'inherit' 可以让子进程直接使用当前终端的输入输出（保留颜色，支持交互）
  const child = spawn('node', [scriptPath], {
    stdio: 'inherit', 
    shell: true 
  });

  // 3. 监听结束
  child.on('close', (code) => {
    console.log('--------------------------------------------------');
    console.log(`✅ 任务结束 (退出码: ${code})`);
  });

} catch (error) {
  if (error.isTtyError) {
    console.error("❌ 无法在当前环境中渲染交互菜单");
  } else {
    console.error("❌ 发生错误:", error);
  }
}