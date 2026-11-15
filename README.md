# 文件中转站 | New File Transfer

基于 Cloudflare Workers + R2 的文件中转站与 WebDAV 配置同步服务。单文件部署（`worker.js`），包含网页上传界面、WebDAV 协议接口、WebDAV 管理界面与全局认证体系。

[![community](https://github.com/user-attachments/assets/653f2b6b-ee32-4f0f-abe0-1ba96e4bb473)](https://linux.do/)

## Fork 说明

- 源项目：[SMNETSTUDIO/File-Transfer](https://github.com/SMNETSTUDIO/File-Transfer)
- 本仓库基于上游项目进行二次修改与公开分发
- 当前仓库继续沿用 `Apache License 2.0`

## 功能总览

- 大文件上传（分片上传，多文件并发）
- 文件分享密码 / 全局登录认证
- 文件过期自动清理、临时下载直链、二维码分享
- **全局登录**：一次登录（7 天会话），中转站与 WebDAV 管理页通用
- **右上角设置**：修改登录账号/密码、自定义网站背景图（持久化到 R2）
- **WebDAV 协议接口**（`/dav/`）：配置同步到 R2，支持 RaiDrive、curl 等客户端
- **WebDAV 管理界面**（`/dav-ui`）：目录化浏览/管理所有同步文件，与主界面分离
- **API v1 程序化接口**（`/api/v1/*`，API Key 认证）

## 界面功能

**文件中转站主页**（登录后）：

- 拖拽/点击上传，多文件并发，实时进度
- 每条上传记录：⬇ 下载（新标签页，有密码的文件先进入密码页）、🔗 分享（二维码弹窗，点击二维码复制链接）、🗑 删除（确认弹窗）
- 上传记录从 R2 元数据恢复，重新部署不丢失；显示剩余有效时间
- 顶部状态卡：剩余存储空间（按 `STORAGE_LIMIT` 计算）、文件过期时间、下载链接有效期

**WebDAV 同步管理页**（`/dav-ui`，登录后）：

- 目录化浏览 `dav/` 前缀下所有同步文件（面包屑导航 + 路径跳转）
- 新建文件夹、上传文件（多选）、文件下载、复制直链、删除（目录递归删除）
- 未登录直接访问会重定向回主页登录
- 顶部「📁 文件中转站」按钮返回主页

**右上角全局按钮**（两页一致）：⚙ 设置（左）、退出登录（右）。

## 全局认证与设置

### 登录

- 访问站点任意页面（中转站 / WebDAV 管理页）都需要登录，一次登录签发 7 天有效的会话 Cookie，两个功能通用。
- 初始凭据：账号为 `CONFIG.WEBDAV_USERNAME`（默认 `admin`），密码为 `CONFIG.ACCESS_PASSWORD`；若 R2 中已有站点配置（`_config/site`），以配置中的账号/密码为准。
- 未登录直接访问 `/dav-ui` 会重定向回主页。

### 设置弹窗（右上角 ⚙）

- **账号**：修改登录用户名（WebDAV 客户端的 Basic Auth 用户名同步变化）
- **新密码**：修改登录密码（留空不修改；网页登录与 WebDAV Basic Auth 同步生效）
- **网站背景**：填入图片地址，支持 `https://` 外链或本站 WebDAV 路径（如 `/dav/wallpaper.jpg`）；留空恢复默认渐变

配置保存在 R2 `_config/site`，密码加盐哈希存储，不存明文。

## 部署方式

单文件 Worker 方案，部署 `worker.js` 并绑定 R2 即可。

### 1. 创建 Worker 与 R2

```bash
wrangler login
wrangler init file-transfer
```

在 Cloudflare Dashboard 创建 R2 Bucket。默认桶名 `file-transfer`，如不同请修改 `worker.js` 里的 `CONFIG.BUCKET_NAME`。

### 2. 绑定 R2

```toml
[[r2_buckets]]
binding = "file-transfer"
bucket_name = "file-transfer"
```

### 3. 可选：绑定 KV（支持 WebDAV LOCK）

部分 WebDAV 客户端写入时需要 `LOCK`，可绑定一个 KV namespace：

```toml
[[kv_namespaces]]
binding = "WEBDAV_LOCKS"
id = "你的 KV namespace id"
```

不绑定不影响基础配置同步，仅 `LOCK`/`UNLOCK` 返回 405。

### 4. 可选：Secret 环境变量

```bash
wrangler secret put WEBDAV_PASSWORD   # WebDAV Basic Auth 回退密码
wrangler secret put SHARE_SECRET_KEY  # 临时下载签名密钥
```

### 5. 部署

```bash
wrangler deploy
```

## 配置项

编辑 `worker.js` 顶部的 `CONFIG`：

```js
const CONFIG = {
  BUCKET_NAME: 'file-transfer',
  ACCESS_PASSWORD: '',            // 初始登录密码（建议部署后立即在设置里改密码）
  SHARE_SECRET_KEY: '',           // 临时下载签名密钥，建议自定义
  TEMP_LINK_EXPIRE: 5 * 60 * 1000,
  MAX_FILE_SIZE: 100 * 1024 * 1024 * 1024,
  STORAGE_LIMIT: 10 * 1024 * 1024 * 1024,
  FILE_EXPIRE_TIME: 7 * 24 * 60 * 60 * 1000,  // 0 = 永不过期
  ALLOWED_TYPES: [],
  CUSTOM_DOMAIN: '',
  MAX_CONCURRENT_UPLOADS: 3,
  CHUNK_SIZE: 50 * 1024 * 1024,
  MULTIPART_THRESHOLD: 100 * 1024 * 1024,
  API_KEY: '',                    // /api/v1/* 密钥，留空则 v1 接口返回 503
  WEBDAV_ENABLED: true,           // WebDAV 接口与管理页开关
  WEBDAV_PATH: '/dav',            // WebDAV 挂载点
  WEBDAV_ROOT_KEY: 'dav/',        // WebDAV 文件在 R2 的存储前缀
  WEBDAV_USERNAME: 'admin',       // 初始登录/WebDAV 账号
  WEBDAV_PASSWORD: '',            // Basic Auth 回退密码（推荐走 Secret）
  WEBDAV_MAX_FILE_SIZE: 10 * 1024 * 1024,  // WebDAV 单文件上限
};
```

## WebDAV 配置同步

把支持 WebDAV 的软件（密码管理器、笔记、RSS、同步工具等）指向本服务的 `/dav/` 地址，配置直接存储到 Cloudflare R2，无需任何第三方服务。

### 连接信息

| 项 | 值 |
|---|---|
| WebDAV URL | `https://your-domain/dav/` |
| 管理界面 | `https://your-domain/dav-ui` |
| 用户名 / 密码 | 与网页登录一致（设置里修改后同步生效） |

### 支持的协议方法

`OPTIONS` / `PROPFIND` / `GET` / `HEAD` / `PUT` / `DELETE` / `MKCOL` / `MOVE` / `COPY` / `LOCK` / `UNLOCK`

- 浏览器访问凭会话 Cookie 放行；WebDAV 客户端用 Basic Auth（账号密码与网页登录一致）。
- 目录用「以 `/` 结尾的空对象」模拟，文件统一存放在 `WEBDAV_ROOT_KEY`（默认 `dav/`）前缀下，与网页上传的 `uploads/` 完全隔离。
- WebDAV 单文件上限 `WEBDAV_MAX_FILE_SIZE`（默认 10MB）；Workers 免费版单请求体上限约 100MB。

### 使用示例（curl）

```bash
# 列目录
curl -u admin:你的密码 -X PROPFIND "https://your-domain/dav/" -H "Depth: 1"

# 上传配置文件
curl -u admin:你的密码 -T ./settings.json "https://your-domain/dav/app/settings.json"

# 下载
curl -u admin:你的密码 "https://your-domain/dav/app/settings.json"

# 创建目录
curl -u admin:你的密码 -X MKCOL "https://your-domain/dav/app/"

# 删除
curl -u admin:你的密码 -X DELETE "https://your-domain/dav/app/settings.json"
```

## API v1 程序化接口（需 API Key）

所有 `/api/v1/*` 接口在请求头携带 `X-API-Key`（值 = `CONFIG.API_KEY`）；留空则返回 503。

### 直接上传文件

```http
PUT /api/v1/upload
X-API-Key: your-api-key
X-Filename: example.apk
Content-Type: application/octet-stream
X-Expire-Ms: 604800000
X-Share-Password: optional-password

<raw file binary content>
```

响应：

```json
{
  "success": true,
  "fileId": "abc123",
  "filename": "example.apk",
  "size": 10485760,
  "downloadUrl": "https://your-domain/d/abc123",
  "expireTime": 1719500000000
}
```

### 从 URL 下载并上传

```http
POST /api/v1/upload-url
X-API-Key: your-api-key
Content-Type: application/json

{
  "url": "https://example.com/file.apk",
  "filename": "custom-name.apk",
  "expireMs": 604800000,
  "sharePassword": "optional-password"
}
```

### 其他端点

- `GET /api/v1/download/:fileId` — 直接返回文件二进制流
- `GET /api/v1/files` — 列出所有文件
- `GET /api/v1/storage` — 查看存储空间
- `POST /api/v1/delete` — 删除文件（`{"fileId": "abc123"}`）

## 项目结构

- `worker.js`：主程序（前端页面 + 全部 API + WebDAV 协议实现）
- `schema.sql`：原项目附带的 D1 SQL（当前代码未使用）
- `preview/`：本地预览工具（Node 内存模拟 R2/KV，`node preview/server.mjs` 后访问 http://127.0.0.1:8787，预置账号 admin/admin；非生产代码）
- `LICENSE.txt`：Apache License 2.0

## 当前行为说明

### 分享链接与临时下载链接

页面中的分享链接是固定入口 `/d/{fileId}`；真正 5 分钟有效的是点击下载后生成的临时直链 `/d/{fileId}?token=...&expires=...`，变化的是 `token` 和 `expires`，不是 `fileId`。

### 剩余存储空间的计算

Worker 侧没有桶剩余空间的现成接口，采用：遍历 R2 `_meta/` 元数据 → 汇总文件大小 → `STORAGE_LIMIT - 已用大小`。这也是顶部「剩余存储空间」卡片的来源。

### 为什么重新部署后还能显示上传记录

上传记录在页面初始化时从 R2 `_meta/` 元数据读取，只要元数据在，记录就能恢复。

## 使用与公开注意事项

### Apache 2.0 下你需要保留的内容

- 保留 `LICENSE.txt` 与上游项目原有版权与归属声明
- 对修改过的文件，在提交记录、README 或发布说明中明确说明"此仓库包含修改"
- 如上游项目包含 `NOTICE` 文件，继续分发时应一并保留其要求

### Cloudflare 相关注意事项

- Cloudflare Workers 免费版有请求额度限制
- R2 Free 套餐有总容量与流量限制
- 分片上传受 Worker 运行时与请求体大小限制影响
- 本项目默认按 `10GB` 计算总容量，请根据实际套餐调整 `STORAGE_LIMIT`

## 许可证

本仓库继续使用 `Apache License 2.0`。
