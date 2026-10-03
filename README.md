# Character Atlas

角色素材库，支持原图上传下载、十维多标签分类、搜索、新词自动入库及手动编辑。

## 模型设置
支持 OpenAI Responses、OpenAI 兼容 Chat Completions、Anthropic Messages、Gemini generateContent 四种协议，以及常见服务地址预设。用户提供自己的 API 密钥和视觉模型 ID；不是所有型号都支持图片。密钥经 AES-GCM 加密存入 D1，不向客户端回传。AI_CONFIG_KEY 仅保存在 Sites 生产环境 secret。分析发送预览图，原图保存在私有 R2。置信度至少0.65的标签自动入库，原有标签保留。

## 开发
Node.js 24，npm install，npm run build，node scripts/smoke.mjs。迁移生成：npm run db:generate。绑定 D1 DB 和 R2 BUCKET。协议适配使用模拟响应测试，实际服务需用户配置密钥后验证。
