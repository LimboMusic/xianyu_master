const http = require('http');

const options = {
    hostname: '127.0.0.1',
    port: 9222,
    path: '/json/version',
    method: 'GET'
};

const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const version = JSON.parse(data);
            console.log('✅ Chrome 远程调试已启动！');
            console.log('版本信息:', version.Browser);
            console.log('WebSocket 端点:', version.webSocketDebuggerUrl);
        } catch (e) {
            console.log('❌ 响应格式错误');
        }
    });
});

req.on('error', (e) => {
    console.log('❌ 无法连接到 Chrome 远程调试端口');
    console.log('请确保运行了 start_chrome.bat 或手动启动了 Chrome');
    console.log('错误详情:', e.message);
});

req.end();




