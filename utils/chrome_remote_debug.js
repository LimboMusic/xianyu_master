import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { sleep } from "./utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_BAT = path.join(__dirname, "..", "start_chrome.bat");

/**
 * 检测本机 Chrome CDP 是否可访问
 * @param {number} [port=9222]
 * @returns {Promise<boolean>}
 */
export async function isCdpAvailable(port = 9222) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForCdp(port, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await isCdpAvailable(port)) return true;
    await sleep(500);
  }
  return false;
}

function launchStartChromeBat(batPath) {
  if (process.platform !== "win32") {
    console.log(
      "start_chrome.bat 仅适用于 Windows，请手动以远程调试方式启动 Chrome。"
    );
    return;
  }
  if (!fs.existsSync(batPath)) {
    console.warn(`未找到 ${batPath}，请手动启动 Chrome 远程调试。`);
    return;
  }
  console.log(`正在通过 ${path.basename(batPath)} 启动 Chrome（远程调试）…`);
  const child = spawn("cmd.exe", ["/c", "start", "", batPath], {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });
  child.unref();
}

/**
 * 若 CDP 端口不可用，则尝试启动项目根目录的 start_chrome.bat（Windows），并等待端口就绪。
 * @param {object} [opts]
 * @param {boolean} [opts.enabled=true] 为 false 时不执行任何操作
 * @param {number} [opts.port=9222]
 * @param {string} [opts.batPath] 默认项目根目录下的 start_chrome.bat
 * @param {number} [opts.timeoutMs=45000] 等待端口就绪的最长时间
 */
export async function ensureChromeRemoteDebugging(opts = {}) {
  const {
    enabled = true,
    port = 9222,
    batPath = DEFAULT_BAT,
    timeoutMs = 45000,
  } = opts;

  if (!enabled) return;

  if (await isCdpAvailable(port)) {
    console.log(`已检测到 Chrome 远程调试端口 ${port}，跳过启动脚本。`);
    return;
  }

  launchStartChromeBat(batPath);
  console.log("等待 Chrome 就绪…");
  const ok = await waitForCdp(port, timeoutMs);
  if (!ok) {
    console.warn(
      `等待 ${port} 端口超时，将仍尝试连接（失败时 Playwright 可能降级为新开浏览器）。`
    );
  } else {
    console.log("Chrome 远程调试已就绪。");
  }
}
