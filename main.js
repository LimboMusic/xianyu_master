import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import Store from 'electron-store';
import cron from 'node-cron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 持久化存储配置
const store = new Store({
  schema: {
    scheduledTasks: {
      type: 'array',
      default: [],
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          scriptPath: { type: 'string' },
          cronExpression: { type: 'string' },
          enabled: { type: 'boolean', default: true },
          lastRun: { type: 'string', default: '' },
          nextRun: { type: 'string', default: '' },
          createdAt: { type: 'string' }
        }
      }
    },
    taskLogs: {
      type: 'array',
      default: [],
      maxItems: 200
    }
  }
});

let mainWindow = null;
const cronJobs = new Map(); // 存储所有定时任务

// 获取所有任务脚本
function getAvailableTasks() {
  const tasks = [
    { name: '每日搜索任务', path: 'tasks/get_shop_review_data.js' },
    { name: '获取飞书聊天链接', path: 'tasks/get_feishu_chat_links.js' },
    { name: '自动点赞任务', path: 'tasks/auto_chat_link.js' },
    { name: '自动回复任务', path: 'tasks/auto_reply.js' },
    { name: '自动发布任务', path: 'tasks/publish_links.js' },
    { name: '关键词搜索任务', path: 'tasks/search_shop_links_by_keyword.js' },
    { name: '发布链接任务', path: 'tasks/publish_links.js' },
    { name: '获取店铺链接', path: 'tasks/get_shop_links.js' },
    { name: '资源处理任务', path: 'tasks/process_link_cozi.js' },
    { name: '每日链接数据更新', path: 'tasks/get_shop_link_date_data.js' }
  ];
  return tasks;
}

// 计算下次执行时间
function calculateNextRun(cronExpression) {
  try {
    const cronParts = cronExpression.split(' ');
    // 简单的 cron 表达式解析用于显示
    let description = cronExpression;
    if (cronParts.length === 5) {
      const [minute, hour, dayOfMonth, month, dayOfWeek] = cronParts;
      const now = new Date();
      let next = new Date(now);
      
      if (hour !== '*') {
        next.setHours(parseInt(hour), parseInt(minute) || 0, 0, 0);
        if (next <= now) next.setDate(next.getDate() + 1);
      } else if (minute !== '*') {
        next.setMinutes(parseInt(minute), 0, 0);
        if (next <= now) next.setMinutes(next.getMinutes() + 60);
      } else {
        next.setMinutes(next.getMinutes() + 1);
      }
      return next.toISOString();
    }
    return '';
  } catch {
    return '';
  }
}

// 执行脚本
function runScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const fullPath = path.join(__dirname, scriptPath);
    const logEntry = {
      id: Date.now().toString(),
      scriptPath,
      startTime: new Date().toISOString(),
      endTime: '',
      status: 'running',
      output: ''
    };

    // 发送开始日志
    if (mainWindow) {
      mainWindow.webContents.send('task-log', logEntry);
    }

    const child = spawn('node', [fullPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      cwd: __dirname
    });

    let output = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      if (mainWindow) {
        mainWindow.webContents.send('task-output', { id: logEntry.id, output: text });
      }
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      if (mainWindow) {
        mainWindow.webContents.send('task-output', { id: logEntry.id, output: text });
      }
    });

    child.on('close', (code) => {
      logEntry.endTime = new Date().toISOString();
      logEntry.status = code === 0 ? 'success' : 'failed';
      logEntry.output = output;

      // 保存日志
      const logs = store.get('taskLogs');
      logs.unshift(logEntry);
      store.set('taskLogs', logs.slice(0, 200));

      if (mainWindow) {
        mainWindow.webContents.send('task-complete', logEntry);
      }
      resolve(logEntry);
    });

    child.on('error', (err) => {
      logEntry.endTime = new Date().toISOString();
      logEntry.status = 'failed';
      logEntry.output = err.message;
      
      const logs = store.get('taskLogs');
      logs.unshift(logEntry);
      store.set('taskLogs', logs.slice(0, 200));

      if (mainWindow) {
        mainWindow.webContents.send('task-complete', logEntry);
      }
      reject(err);
    });
  });
}

// 注册定时任务
function registerCronTask(task) {
  // 先移除已存在的任务
  if (cronJobs.has(task.id)) {
    cronJobs.get(task.id).stop();
  }

  if (!task.enabled) return;

  try {
    const job = cron.schedule(task.cronExpression, async () => {
      const now = new Date().toISOString();
      task.lastRun = now;
      
      // 更新下次运行时间
      const scheduledTasks = store.get('scheduledTasks');
      const idx = scheduledTasks.findIndex(t => t.id === task.id);
      if (idx !== -1) {
        scheduledTasks[idx].lastRun = now;
        store.set('scheduledTasks', scheduledTasks);
      }

      // 通知前端任务开始
      if (mainWindow) {
        mainWindow.webContents.send('task-triggered', task);
      }

      await runScript(task.scriptPath);
    });

    cronJobs.set(task.id, job);
    
    // 更新下次运行时间
    const scheduledTasks = store.get('scheduledTasks');
    const idx = scheduledTasks.findIndex(t => t.id === task.id);
    if (idx !== -1) {
      scheduledTasks[idx].nextRun = calculateNextRun(task.cronExpression);
      store.set('scheduledTasks', scheduledTasks);
    }

    return true;
  } catch (err) {
    console.error(`定时任务注册失败: ${task.name}`, err);
    return false;
  }
}

// 初始化所有已保存的定时任务
function initScheduledTasks() {
  const scheduledTasks = store.get('scheduledTasks');
  scheduledTasks.forEach(task => {
    registerCronTask(task);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: path.join(__dirname, 'modules/image/baidu.png'),
    title: '闲鱼自动化助手'
  });

  mainWindow.loadFile('index.html');

  // 初始化定时任务
  initScheduledTasks();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ========== IPC Handlers ==========

// 获取可用任务列表
ipcMain.handle('get-available-tasks', () => {
  return getAvailableTasks();
});

// 获取已保存的定时任务
ipcMain.handle('get-scheduled-tasks', () => {
  return store.get('scheduledTasks');
});

// 添加定时任务
ipcMain.handle('add-scheduled-task', (event, taskData) => {
  const task = {
    id: Date.now().toString(),
    name: taskData.name,
    scriptPath: taskData.scriptPath,
    cronExpression: taskData.cronExpression,
    enabled: taskData.enabled !== false,
    lastRun: '',
    nextRun: calculateNextRun(taskData.cronExpression),
    createdAt: new Date().toISOString()
  };

  const scheduledTasks = store.get('scheduledTasks');
  scheduledTasks.push(task);
  store.set('scheduledTasks', scheduledTasks);

  registerCronTask(task);
  
  return { success: true, task };
});

// 更新定时任务
ipcMain.handle('update-scheduled-task', (event, taskData) => {
  const scheduledTasks = store.get('scheduledTasks');
  const idx = scheduledTasks.findIndex(t => t.id === taskData.id);
  
  if (idx !== -1) {
    scheduledTasks[idx] = { ...scheduledTasks[idx], ...taskData };
    scheduledTasks[idx].nextRun = calculateNextRun(scheduledTasks[idx].cronExpression);
    store.set('scheduledTasks', scheduledTasks);
    
    registerCronTask(scheduledTasks[idx]);
    return { success: true, task: scheduledTasks[idx] };
  }
  
  return { success: false, error: '任务未找到' };
});

// 删除定时任务
ipcMain.handle('delete-scheduled-task', (event, taskId) => {
  // 停止定时任务
  if (cronJobs.has(taskId)) {
    cronJobs.get(taskId).stop();
    cronJobs.delete(taskId);
  }

  const scheduledTasks = store.get('scheduledTasks');
  const filtered = scheduledTasks.filter(t => t.id !== taskId);
  store.set('scheduledTasks', filtered);
  
  return { success: true };
});

// 立即运行脚本
ipcMain.handle('run-script', async (event, scriptPath) => {
  const result = await runScript(scriptPath);
  return result;
});

// 获取任务日志
ipcMain.handle('get-task-logs', () => {
  return store.get('taskLogs');
});

// 清空日志
ipcMain.handle('clear-logs', () => {
  store.set('taskLogs', []);
  return { success: true };
});

// 切换任务启用状态
ipcMain.handle('toggle-task', (event, taskId) => {
  const scheduledTasks = store.get('scheduledTasks');
  const idx = scheduledTasks.findIndex(t => t.id === taskId);
  
  if (idx !== -1) {
    scheduledTasks[idx].enabled = !scheduledTasks[idx].enabled;
    store.set('scheduledTasks', scheduledTasks);
    
    registerCronTask(scheduledTasks[idx]);
    return { success: true, task: scheduledTasks[idx] };
  }
  
  return { success: false, error: '任务未找到' };
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // 停止所有定时任务
  cronJobs.forEach(job => job.stop());
  cronJobs.clear();
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
