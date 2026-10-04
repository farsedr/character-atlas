# 拾光图鉴通用本机连接包（Codex / Gemini）

连接包同时支持两种来源，安装步骤不同，配对流程相同。每位用户登录自己的账号，无需 API 密钥。

## Codex

安装 Node.js 22+，运行 npm install -g @openai/codex，然后 codex login，用自己的 ChatGPT 账号登录。

## Gemini

安装 Node.js 22+，运行 npm install -g @google/gemini-cli，然后 gemini，选择 Login with Google，完成个人 Google 账号登录后退出 CLI。

## 启动、连接和模型选择

完整解压。Windows 双击 start-local-models.cmd，或 start-codex.cmd / start-gemini.cmd；macOS / Linux 运行 sh start.sh。三个 Windows 入口启动相同通用服务，来源在网站中选择。

打开 http://127.0.0.1:4379/，复制本次连接码。在网站「模型设置 → 本机模型」选择本机 Codex / 本机 Gemini，粘贴连接码并连接，允许访问本地网络。Gemini 请明确选择本机 Gemini，再选择账号允许的模型。

默认 Codex GPT-6 Luna / low，Gemini Gemini 2.5 Flash Lite / default；实际授权与额度以账号为准。失败不自动升级模型。Gemini 检测登录缓存，实际分析仍需网络和模型权限。

连接程序必须保持运行；每次重启重新配对。安装位置自动寻找，无固定用户路径，不包含账号、API 密钥或配对码。

完整说明：docs/USER-GUIDE.md

在线指引：https://character-atlas-wang-20261003.wqlwoaiwo.chatgpt.site/connection-guide.html