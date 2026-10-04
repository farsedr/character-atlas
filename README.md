# 拾光图鉴

独立账号的云端图片管理应用，支持本机 Codex / Gemini、24 维视觉分析、自定义 Skill、动态子标签、自动命名与灵感集自动分组。

- [打开网站](https://character-atlas-wang-20261003.wqlwoaiwo.chatgpt.site/)
- [下载发布包](https://github.com/farsedr/character-atlas/releases/latest)
- [完整使用说明](docs/USER-GUIDE.md)
- [安装与连接指引](https://character-atlas-wang-20261003.wqlwoaiwo.chatgpt.site/connection-guide.html)

GitHub Release 包含完整源码 ZIP、通用连接 ZIP、使用说明与 SHA256 校验文件。每位用户自行安装 CLI、登录和配对，默认使用轻量模型，不因失败自动升级。API 配置是可选项。

原图和批量 ZIP 按当前素材名命名，同名文件自动加序号。手动标签、提示词和手动分组保留。云端 D1 保存元数据，R2 保存原图和预览；用户资料不在 GitHub 仓库中。

## 开发

Node.js 24+：

    npm ci
    npm run build
    npm test
    npm run preview

预览数据与生产隔离。生产使用 Sites DB / BUCKET 绑定，应用 drizzle 所有迁移。部署秘密 AI_CONFIG_KEY 不得公开或随意轮换。详见使用说明。

    node scripts/package-connector.mjs
    node scripts/package-release.mjs

邮箱目前仅作为登录名，找回密码使用恢复代码，不支持邮件找回。
