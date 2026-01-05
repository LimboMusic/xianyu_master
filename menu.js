import inquirer from 'inquirer';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// 修正 ESM 环境下的路径问题
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const questions = [
  {
    type: 'rawlist', // 关键修改：从 'list' 改为 'rawlist'
    name: 'scriptToRun',
    message: '你想运行哪个脚本？(请输入左侧的数字编号)',
    choices: [
      {
        name: '每日搜索任务 (get_shop_review_data.js)',
        value: 'tasks/get_shop_review_data.js'
      },
      {
        name: '获取飞书聊天链接任务 (get_feishu_chat_links.js)',
        value: 'tasks/get_feishu_chat_links.js'
      },
      {
        name: '自动点赞任务 (auto_chat_link.js)',
        value: 'tasks/auto_chat_link.js'
      },
      {
        name: '自动回复任务 (auto_reply.js)',
        value: 'tasks/auto_reply.js'
      },
      {
        name: '自动发布任务 (publish_links.js)',
        value: 'tasks/publish_links.js'
      },
      {
        name: '自动根据关键词搜索任务 (search_shop_links_by_keyword.js)',
        value: 'tasks/search_shop_links_by_keyword.js'
      },
      {
        name: '发布链接任务 (publish_links.js)',
        value: 'tasks/publish_links.js'
      },
      {
        name: '获取指定店铺链接任务 (get_shop_links.js)',
        value: 'tasks/get_shop_links.js'
      },
    ]
  }
];

inquirer.prompt(questions).then((answers) => {
  // 使用 path.join 确保在 Windows 环境下路径斜杠正确
  const scriptPath = path.join(__dirname, answers.scriptToRun);

  console.log(`\n🚀 准备执行: ${scriptPath}`);

  const child = spawn('node', [scriptPath], {
    stdio: 'inherit',
    shell: true // Windows 建议开启 shell 模式以增强兼容性
  });

  child.on('error', (err) => {
    console.error(`\n❌ 启动失败: ${err.message}`);
  });

  child.on('close', (code) => {
    console.log(`\n✅ 脚本执行结束，退出码: ${code}`);
  });
});
