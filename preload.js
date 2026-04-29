const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 获取可用任务列表
  getAvailableTasks: () => ipcRenderer.invoke('get-available-tasks'),

  // 获取已保存的定时任务
  getScheduledTasks: () => ipcRenderer.invoke('get-scheduled-tasks'),

  // 添加定时任务
  addScheduledTask: (taskData) => ipcRenderer.invoke('add-scheduled-task', taskData),

  // 更新定时任务
  updateScheduledTask: (taskData) => ipcRenderer.invoke('update-scheduled-task', taskData),

  // 删除定时任务
  deleteScheduledTask: (taskId) => ipcRenderer.invoke('delete-scheduled-task', taskId),

  // 立即运行脚本
  runScript: (scriptPath) => ipcRenderer.invoke('run-script', scriptPath),

  // 获取任务日志
  getTaskLogs: () => ipcRenderer.invoke('get-task-logs'),

  // 清空日志
  clearLogs: () => ipcRenderer.invoke('clear-logs'),

  // 切换任务启用状态
  toggleTask: (taskId) => ipcRenderer.invoke('toggle-task', taskId),

  // 监听任务日志更新
  onTaskLog: (callback) => {
    ipcRenderer.on('task-log', (event, data) => callback(data));
  },

  // 监听任务实时输出
  onTaskOutput: (callback) => {
    ipcRenderer.on('task-output', (event, data) => callback(data));
  },

  // 监听任务完成
  onTaskComplete: (callback) => {
    ipcRenderer.on('task-complete', (event, data) => callback(data));
  },

  // 监听定时任务触发
  onTaskTriggered: (callback) => {
    ipcRenderer.on('task-triggered', (event, data) => callback(data));
  },

  // 移除所有监听器
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
