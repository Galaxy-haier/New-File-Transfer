// ==================== 配置区域 ====================
const CONFIG = {
  // R2 Bucket 名称
  BUCKET_NAME: 'file-transfer',

  // 全局访问密码（留空则不启用全局密码验证）
  ACCESS_PASSWORD: '',

  // 文件分享密码密钥（用于生成临时下载签名，建议设置复杂随机字符串）
  // 如不设置，将使用默认密钥（生产环境请务必自定义）
  SHARE_SECRET_KEY: '',

  // 临时下载链接有效期（毫秒）默认5分钟
  TEMP_LINK_EXPIRE: 5 * 60 * 1000,

  // 文件大小限制（字节）默认 100GB
  MAX_FILE_SIZE: 100 * 1024 * 1024 * 1024,

  // 存储桶总容量（字节）默认 10GB，Cloudflare R2 Free 套餐通常为 10GB
  STORAGE_LIMIT: 10 * 1024 * 1024 * 1024,

  // 文件过期时间（毫秒）默认 7天，0 表示永不过期
  FILE_EXPIRE_TIME: 7 * 24 * 60 * 60 * 1000,

  // 允许的文件类型（留空数组表示允许所有）
  // 例如: ['image/png', 'image/jpeg', 'application/pdf']
  ALLOWED_TYPES: [],

  // 自定义域名（如果有绑定自定义域名，填写这里）
  CUSTOM_DOMAIN: 'https://yunpan.zsxh.me',

  // API Key（用于程序化访问 /api/v1/* 接口，留空则不启用 API Key 认证）
  API_KEY: '8809f02abe9ec29cfbe57f915ff804e395bb52688fbf093abfb831360c704596',

  // 最大并发上传数
  MAX_CONCURRENT_UPLOADS: 3,

  // 分片上传配置
  // 分片大小（字节）默认 50MB，Cloudflare Workers 限制单个请求 100MB，建议不超过 50MB
  CHUNK_SIZE: 50 * 1024 * 1024,
  // 启用分片上传的文件大小阈值（字节）默认 100MB
  MULTIPART_THRESHOLD: 100 * 1024 * 1024,

  // ==================== WebDAV 配置（配置同步用）====================
  // 是否启用 WebDAV 接口（对外暴露 /dav 挂载点，文件存 R2）
  WEBDAV_ENABLED: true,

  // WebDAV 挂载点 URL 前缀（客户端连接地址为 https://your-domain/dav/）
  WEBDAV_PATH: '/dav',

  // WebDAV 文件在 R2 中的存储前缀（与网页上传的 uploads/ 隔离）
  WEBDAV_ROOT_KEY: 'dav/',

  // WebDAV 认证用户名
  WEBDAV_USERNAME: 'admin',

  // WebDAV 认证密码：留空则读取环境变量 WEBDAV_PASSWORD（推荐），
  // 也可直接填在这里（会明文打包进脚本，仅本地测试建议）
  WEBDAV_PASSWORD: '',

  // WebDAV 单文件大小上限（字节）。配置同步场景普遍很小，默认 10MB，
  // 注意 Cloudflare Workers 免费版单请求体上限约 100MB
  WEBDAV_MAX_FILE_SIZE: 10 * 1024 * 1024,
};

const FAVICON_DATA_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath fill='%2338BDF8' d='M8 16.5A4.5 4.5 0 0 1 12.5 12H25l5.2 5.2H51.5A4.5 4.5 0 0 1 56 21.7v24.8A5.5 5.5 0 0 1 50.5 52h-37A5.5 5.5 0 0 1 8 46.5v-30Z'/%3E%3Cpath fill='%230EA5E9' d='M8 24.5A5.5 5.5 0 0 1 13.5 19H50.2A5.8 5.8 0 0 1 56 24.8v21.7A5.5 5.5 0 0 1 50.5 52h-37A5.5 5.5 0 0 1 8 46.5v-22Z'/%3E%3C/svg%3E";

// ==================== HTML 模板 ====================
const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
  <title>文件中转站 | New File Transfer</title>
  <link rel="icon" href="${FAVICON_DATA_URL}">
  <!-- QR Code Generator 库 -->
  <script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>
  <style>
    :root {
      --bg-primary: #0a0a0f;
      --bg-secondary: #12121a;
      --bg-card: rgba(30, 30, 45, 0.6);
      --border-color: rgba(255, 255, 255, 0.1);
      --text-primary: #ffffff;
      --text-secondary: #a0a0b0;
      --accent-purple: #8b5cf6;
      --accent-blue: #3b82f6;
      --accent-cyan: #06b6d4;
      --accent-pink: #ec4899;
      --success: #10b981;
      --error: #ef4444;
      --warning: #f59e0b;
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-primary);
      min-height: 100vh;
      padding: 24px;
      color: var(--text-primary);
      background-image: 
        radial-gradient(ellipse at 20% 20%, rgba(139, 92, 246, 0.15) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 80%, rgba(6, 182, 212, 0.1) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 50%, rgba(59, 130, 246, 0.05) 0%, transparent 70%);
    }
    
    .container {
      max-width: 1000px;
      margin: 0 auto;
    }
    
    /* Header */
    .header {
      text-align: center;
      margin-bottom: 32px;
      padding: 20px 0;
    }
    
    .header h1 {
      font-size: 2.5rem;
      font-weight: 700;
      background: linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-cyan) 50%, var(--accent-pink) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 8px;
      letter-spacing: -0.02em;
    }
    
    .header p {
      color: var(--text-secondary);
      font-size: 1rem;
    }
    
    /* Stats Cards */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    
    .stat-card {
      background: var(--bg-card);
      backdrop-filter: blur(20px);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 20px;
      transition: all 0.3s ease;
    }
    
    .stat-card:hover {
      transform: translateY(-2px);
      border-color: rgba(139, 92, 246, 0.3);
      box-shadow: 0 8px 32px rgba(139, 92, 246, 0.15);
    }
    
    .stat-label {
      font-size: 12px;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }
    
    .stat-value {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--text-primary);
    }
    
    .stat-value.purple { color: var(--accent-purple); }
    .stat-value.cyan { color: var(--accent-cyan); }
    .stat-value.pink { color: var(--accent-pink); }
    
    /* Main Card */
    .card {
      background: var(--bg-card);
      backdrop-filter: blur(20px);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      padding: 32px;
      margin-bottom: 24px;
      transition: all 0.3s ease;
    }
    
    .card:hover {
      border-color: rgba(139, 92, 246, 0.2);
    }
    
    /* Upload Area */
    .upload-area {
      border: 2px dashed rgba(139, 92, 246, 0.3);
      border-radius: 16px;
      padding: 48px 32px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s ease;
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(6, 182, 212, 0.05) 100%);
      position: relative;
      overflow: hidden;
    }
    
    .upload-area::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%);
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    
    .upload-area:hover, .upload-area.dragover {
      border-color: var(--accent-purple);
      transform: translateY(-2px);
      box-shadow: 0 20px 40px rgba(139, 92, 246, 0.2);
    }
    
    .upload-area:hover::before, .upload-area.dragover::before {
      opacity: 1;
    }
    
    .upload-icon {
      font-size: 64px;
      margin-bottom: 16px;
      background: linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-cyan) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      position: relative;
      z-index: 1;
    }
    
    .upload-text {
      color: var(--text-secondary);
      font-size: 16px;
      position: relative;
      z-index: 1;
    }
    
    .upload-text strong {
      color: var(--text-primary);
      font-weight: 600;
    }
    
    #fileInput { display: none; }
    
    /* Share Password Area */
    .share-password-area {
      margin-top: 24px;
      padding: 20px;
      background: rgba(139, 92, 246, 0.08);
      border: 1px solid rgba(139, 92, 246, 0.2);
      border-radius: 12px;
    }
    
    .share-password-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 600;
      color: var(--accent-purple);
      margin-bottom: 12px;
    }
    
    .share-password-input {
      width: 100%;
      padding: 12px 16px;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      font-size: 14px;
      color: var(--text-primary);
      transition: all 0.2s ease;
    }
    
    .share-password-input:focus {
      outline: none;
      border-color: var(--accent-purple);
      box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);
    }
    
    .share-password-input::placeholder {
      color: var(--text-secondary);
    }
    
    .share-password-hint {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    /* File List */
    .file-list {
      margin-top: 32px;
      border-top: 1px solid var(--border-color);
      padding-top: 24px;
    }
    
    .file-list-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .file-list-title span:last-child {
      background: var(--accent-purple);
      color: white;
      padding: 2px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
    }
    
    .file-items {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .file-item {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 16px;
      transition: all 0.2s ease;
    }
    
    .file-item:hover {
      border-color: rgba(139, 92, 246, 0.3);
      background: rgba(139, 92, 246, 0.05);
    }
    
    .file-item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 12px;
    }
    
    .file-name {
      font-weight: 500;
      color: var(--text-primary);
      word-break: break-all;
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .file-name::before {
      content: '📄';
    }

    .file-meta-group {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .file-size {
      font-size: 12px;
      color: var(--text-secondary);
      background: rgba(255, 255, 255, 0.05);
      padding: 4px 12px;
      border-radius: 20px;
      font-weight: 500;
    }

    .file-expire {
      font-size: 12px;
      color: var(--accent-cyan);
      background: rgba(6, 182, 212, 0.12);
      border: 1px solid rgba(6, 182, 212, 0.16);
      padding: 4px 12px;
      border-radius: 20px;
      font-weight: 500;
    }

    .file-expire.urgent {
      color: var(--warning);
      background: rgba(245, 158, 11, 0.14);
      border-color: rgba(245, 158, 11, 0.2);
    }

    .file-expire.expired {
      color: var(--error);
      background: rgba(239, 68, 68, 0.14);
      border-color: rgba(239, 68, 68, 0.2);
    }
    
    .file-status {
      font-size: 12px;
      padding: 4px 12px;
      border-radius: 20px;
      font-weight: 500;
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-secondary);
    }
    
    .file-status.success { 
      background: rgba(16, 185, 129, 0.15); 
      color: var(--success); 
    }
    .file-status.error { 
      background: rgba(239, 68, 68, 0.15); 
      color: var(--error); 
    }
    .file-status.uploading { 
      background: rgba(139, 92, 246, 0.15); 
      color: var(--accent-purple); 
    }
    
    .progress-bar-container {
      height: 6px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 3px;
      overflow: hidden;
      margin: 12px 0;
    }
    
    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--accent-purple), var(--accent-cyan));
      width: 0%;
      transition: width 0.3s ease;
      border-radius: 3px;
    }
    
    .file-result {
      margin-top: 16px;
      display: flex;
      flex-wrap: nowrap;
      gap: 10px;
      align-items: center;
      background: rgba(16, 185, 129, 0.08);
      padding: 16px;
      border-radius: 10px;
      border: 1px solid rgba(16, 185, 129, 0.2);
    }

    .file-result-link {
      flex: 1 1 auto;
      min-width: 0;
    }

    .download-link-input {
      width: 100%;
      padding: 12px 14px;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(6, 182, 212, 0.15);
      border-radius: 10px;
      color: var(--text-primary);
      font-size: 13px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: text;
    }

    .download-link-input:focus {
      outline: none;
      border-color: rgba(6, 182, 212, 0.4);
      box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.12);
    }

    .file-result-actions {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      flex-wrap: nowrap;
      flex-shrink: 0;
    }
    
    .btn-sm {
      padding: 8px 16px;
      font-size: 13px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 500;
    }
    
    .btn-download {
      background: var(--accent-cyan);
      color: white;
    }
    .btn-download:hover {
      background: #0891b2;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);
    }

    .btn-qr {
      background: var(--accent-purple);
      color: white;
    }
    .btn-qr:hover {
      background: #7c3aed;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
    }

    .btn-delete {
      background: rgba(239, 68, 68, 0.14);
      color: #fca5a5;
      border: 1px solid rgba(239, 68, 68, 0.25);
    }
    .btn-delete:hover {
      background: rgba(239, 68, 68, 0.2);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
    }
    .btn-delete:disabled,
    .btn-qr:disabled,
    .btn-download:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
    
    .password-badge {
      background: rgba(245, 158, 11, 0.15);
      color: var(--warning);
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .danger-modal {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(12px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      z-index: 2200;
    }

    .danger-modal-dialog {
      width: min(100%, 420px);
      background: linear-gradient(180deg, rgba(30, 30, 45, 0.97), rgba(18, 18, 26, 0.98));
      border: 1px solid rgba(239, 68, 68, 0.18);
      border-radius: 24px;
      padding: 28px;
      box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45);
    }

    .danger-modal-icon {
      width: 52px;
      height: 52px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      color: #fecaca;
      background: rgba(239, 68, 68, 0.14);
      border: 1px solid rgba(239, 68, 68, 0.2);
      margin-bottom: 18px;
    }

    .danger-modal-title {
      font-size: 22px;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 10px;
    }

    .danger-modal-desc {
      color: var(--text-secondary);
      font-size: 14px;
      line-height: 1.7;
      margin-bottom: 20px;
      word-break: break-all;
    }

    .danger-modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      flex-wrap: wrap;
    }

    .btn-ghost,
    .btn-danger {
      padding: 11px 18px;
      border-radius: 12px;
      border: none;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.2s ease;
    }

    .btn-ghost {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-primary);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .btn-ghost:hover {
      background: rgba(255, 255, 255, 0.12);
    }

    .btn-danger {
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(220, 38, 38, 0.95));
      color: white;
    }

    .btn-danger:hover {
      transform: translateY(-1px);
      box-shadow: 0 12px 24px rgba(239, 68, 68, 0.24);
    }

    .btn-ghost:disabled,
    .btn-danger:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
    
    .qr-modal {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(14px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      z-index: 2100;
    }

    .qr-modal-dialog {
      width: min(100%, 420px);
      background: linear-gradient(180deg, rgba(30, 30, 45, 0.95), rgba(18, 18, 26, 0.98));
      border: 1px solid rgba(139, 92, 246, 0.2);
      border-radius: 24px;
      padding: 28px;
      box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45);
      position: relative;
    }

    .qr-modal-close {
      position: absolute;
      top: 16px;
      right: 16px;
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 16px;
    }

    .qr-modal-close:hover {
      background: rgba(255, 255, 255, 0.14);
      color: var(--text-primary);
      transform: translateY(-1px);
    }

    .qr-modal-label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--accent-cyan);
      margin-bottom: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .qr-modal-title {
      font-size: 22px;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 10px;
      word-break: break-all;
      padding-right: 36px;
    }

    .qr-modal-desc {
      font-size: 14px;
      color: var(--text-secondary);
      margin-bottom: 20px;
      line-height: 1.6;
    }

    .qr-modal-card {
      width: 100%;
      border: 1px solid rgba(139, 92, 246, 0.18);
      border-radius: 20px;
      padding: 18px;
      background:
        linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(6, 182, 212, 0.08)),
        rgba(255, 255, 255, 0.03);
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: center;
    }

    .qr-modal-card:hover {
      transform: translateY(-2px);
      border-color: rgba(139, 92, 246, 0.3);
      box-shadow: 0 16px 36px rgba(139, 92, 246, 0.16);
    }

    .qr-modal-card:focus-visible {
      outline: 2px solid rgba(6, 182, 212, 0.65);
      outline-offset: 3px;
    }

    .qr-modal-canvas {
      width: 100%;
      display: flex;
      justify-content: center;
      margin-bottom: 12px;
      min-height: 192px;
      align-items: center;
    }

    .qr-modal-hint {
      font-size: 13px;
      color: var(--text-secondary);
    }
    
    .qr-canvas {
      display: block;
      width: 100px;
      height: 100px;
    }
    
    /* Toast */
    .toast {
      position: fixed;
      top: 24px;
      right: 24px;
      padding: 16px 24px;
      border-radius: 12px;
      color: white;
      font-weight: 500;
      z-index: 2300;
      animation: slideIn 0.3s ease;
      max-width: 400px;
      font-size: 14px;
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .toast.success { 
      background: rgba(16, 185, 129, 0.9);
      box-shadow: 0 8px 32px rgba(16, 185, 129, 0.3);
    }
    .toast.error { 
      background: rgba(239, 68, 68, 0.9);
      box-shadow: 0 8px 32px rgba(239, 68, 68, 0.3);
    }
    .toast.info { 
      background: rgba(59, 130, 246, 0.9);
      box-shadow: 0 8px 32px rgba(59, 130, 246, 0.3);
    }
    
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    /* Password Modal（毛玻璃：透出并模糊后方页面） */
    .password-modal {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(10, 10, 15, 0.45);
      backdrop-filter: blur(18px) saturate(1.2);
      -webkit-backdrop-filter: blur(18px) saturate(1.2);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    }
    
    .password-box {
      background: rgba(30, 30, 45, 0.55);
      backdrop-filter: blur(28px) saturate(1.3);
      -webkit-backdrop-filter: blur(28px) saturate(1.3);
      border: 1px solid rgba(255, 255, 255, 0.14);
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.08);
      padding: 40px;
      border-radius: 20px;
      text-align: center;
      max-width: 420px;
      width: 90%;
    }
    
    .password-box h2 {
      margin-bottom: 8px;
      color: var(--text-primary);
      font-size: 1.5rem;
    }
    
    .password-box p {
      color: var(--text-secondary);
      margin-bottom: 24px;
      font-size: 14px;
    }
    
    .password-input {
      width: 100%;
      padding: 14px 18px;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      font-size: 16px;
      color: var(--text-primary);
      margin-bottom: 20px;
      transition: all 0.2s ease;
    }
    
    .password-input:focus {
      outline: none;
      border-color: var(--accent-purple);
      box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);
    }
    
    .password-input::placeholder {
      color: var(--text-secondary);
    }
    
    .btn-primary {
      width: 100%;
      padding: 14px 24px;
      background: linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-blue) 100%);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(139, 92, 246, 0.4);
    }
    
    .hidden { display: none !important; }
    .text-muted { color: var(--text-secondary); font-size: 12px; }
    
    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 48px 20px;
      color: var(--text-secondary);
    }
    
    .empty-state-icon {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }
    
    /* Animations */
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    .animate-pulse {
      animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    
    /* Responsive */
    @media (max-width: 640px) {
      body { padding: 16px; }
      .header h1 { font-size: 1.75rem; }
      .card { padding: 20px; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .file-item-header {
        align-items: flex-start;
      }
      .file-meta-group {
        width: 100%;
      }
      .file-result {
        flex-wrap: wrap;
      }
      .file-result-link {
        flex-basis: 100%;
      }
      .file-result-actions {
        width: 100%;
      }
      .qr-modal-dialog {
        padding: 24px 18px 18px;
      }
      .qr-modal-canvas {
        min-height: 168px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📁 文件中转站</h1>
      <p>安全、快速的文件分享服务</p>
      <p style="margin-top:12px"><a href="/dav-ui" style="display:inline-flex;align-items:center;gap:6px;color:var(--accent-cyan);font-size:14px;text-decoration:none;border:1px solid rgba(6,182,212,0.35);background:rgba(6,182,212,0.08);padding:8px 18px;border-radius:20px;transition:all 0.2s ease;">🗂 WebDAV 同步管理</a></p>
    </div>
    
    <!-- Stats Grid -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">剩余存储空间</div>
        <div class="stat-value purple" id="storageRemainingValue">计算中...</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">文件过期时间</div>
        <div class="stat-value cyan">${CONFIG.FILE_EXPIRE_TIME ? Math.floor(CONFIG.FILE_EXPIRE_TIME / 86400000) + '天' : '永久'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">下载链接有效期</div>
        <div class="stat-value pink">5分钟</div>
      </div>
    </div>
    
    <div id="passwordModal" class="password-modal hidden">
      <div class="password-box">
        <div style="font-size: 64px; margin-bottom: 16px;">🔐</div>
        <h2>访问受限</h2>
        <p>请输入账号与密码以继续使用</p>
        <input type="text" class="password-input" id="loginUsername" placeholder="账号" autocomplete="username" style="margin-bottom:12px">
        <input type="password" class="password-input" id="passwordInput" placeholder="密码..." autocomplete="current-password">
        <button class="btn-primary" onclick="verifyPassword()">进入系统</button>
      </div>
    </div>

    <div id="settingsModal" class="password-modal hidden">
      <div class="password-box" style="text-align:left">
        <div style="font-size:48px;margin-bottom:12px;text-align:center">⚙️</div>
        <h2 style="text-align:center;margin-bottom:20px">设置</h2>
        <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px">账号</label>
        <input type="text" class="password-input" id="setAuthUser" placeholder="登录账号" style="margin-bottom:14px">
        <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px">新密码（留空则不修改）</label>
        <input type="password" class="password-input" id="setNewPassword" placeholder="新密码" autocomplete="new-password" style="margin-bottom:14px">
        <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px">网站背景（https 图片地址或 WebDAV 图片路径，如 /dav/wallpaper.jpg，留空恢复默认）</label>
        <input type="text" class="password-input" id="setBgUrl" placeholder="https://... 或 /dav/xxx.jpg" style="margin-bottom:18px">
        <button class="btn-primary" id="settingsSaveBtn" style="margin-bottom:10px">保存设置</button>
        <button class="btn-primary" id="settingsCloseBtn" style="background:rgba(255,255,255,0.1)">关闭</button>
      </div>
    </div>

    <button id="settingsBtn" title="设置" style="position:fixed;top:16px;right:72px;z-index:1500;width:42px;height:42px;border-radius:12px;border:1px solid var(--border-color);background:rgba(30,30,45,0.7);backdrop-filter:blur(10px);color:var(--text-primary);font-size:19px;cursor:pointer;transition:all 0.2s ease;">⚙</button>
    <button id="logoutBtn" title="退出登录" style="position:fixed;top:16px;right:16px;z-index:1500;width:42px;height:42px;border-radius:12px;border:1px solid var(--border-color);background:rgba(30,30,45,0.7);backdrop-filter:blur(10px);color:var(--text-primary);cursor:pointer;transition:all 0.2s ease;display:flex;align-items:center;justify-content:center;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
    </button>

    <div id="qrShareModal" class="qr-modal hidden" aria-hidden="true">
      <div class="qr-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="qrModalTitle">
        <button class="qr-modal-close" id="qrModalClose" type="button" aria-label="关闭二维码弹窗">✕</button>
        <div class="qr-modal-label">🔲 分享二维码</div>
        <div class="qr-modal-title" id="qrModalTitle">分享二维码</div>
        <div class="qr-modal-desc" id="qrModalDesc">扫码即可下载，点击下方卡片还能复制分享链接。</div>
        <div class="qr-modal-card" id="qrModalCopyCard" role="button" tabindex="0">
          <div class="qr-modal-canvas" id="qrModalCanvas"></div>
          <div class="qr-modal-hint">点击二维码复制链接</div>
        </div>
      </div>
    </div>

    <div id="deleteConfirmModal" class="danger-modal hidden" aria-hidden="true">
      <div class="danger-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="deleteModalTitle">
        <div class="danger-modal-icon">🗑</div>
        <div class="danger-modal-title" id="deleteModalTitle">确认删除文件</div>
        <div class="danger-modal-desc" id="deleteModalDesc">删除后将从存储桶中移除，且无法恢复。</div>
        <div class="danger-modal-actions">
          <button class="btn-ghost" id="deleteModalCancel" type="button">取消</button>
          <button class="btn-danger" id="deleteModalConfirm" type="button">确认删除</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="upload-area" id="uploadArea">
        <div class="upload-icon">☁️</div>
        <div class="upload-text">
          <strong>点击或拖拽文件</strong> 到此处上传<br>
          <small style="opacity: 0.6; margin-top: 8px; display: inline-block;">支持多文件同时上传</small>
        </div>
      </div>
      <input type="file" id="fileInput" multiple>
      
      <!-- 分享密码输入区域 -->
      <div class="share-password-area">
        <label class="share-password-label">
          <span>🔐</span>
          <span>分享密码（可选）</span>
        </label>
        <input type="text" id="sharePasswordInput" class="share-password-input" placeholder="设置密码后，他人下载文件时需要输入此密码" autocomplete="off">
        <div class="share-password-hint">
          <span>💡</span>
          <span>留空则不设置密码保护，此密码将应用于本次上传的所有文件</span>
        </div>
      </div>
      
      <div class="file-list" id="fileListContainer">
        <div class="file-list-title">
          <span>📋 上传记录</span>
          <span id="uploadCountBadge"></span>
        </div>
        <div id="fileItemsList" class="file-items">
          <div class="empty-state">
            <div class="empty-state-icon">📂</div>
            <div>暂无上传文件，请选择文件开始</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const CONFIG = ${JSON.stringify(CONFIG)};
    let currentUploadTasks = [];
    let activeUploads = 0;
    let pendingQueue = [];
    let fileItemsMap = new Map();
    let fileExpiryMap = new Map();
    let expiryRefreshTimer = null;
    let deleteModalState = { fileId: '', busy: false };
    let storageState = {
      limitBytes: CONFIG.STORAGE_LIMIT || 10 * 1024 * 1024 * 1024,
      usedBytes: 0,
      remainingBytes: CONFIG.STORAGE_LIMIT || 10 * 1024 * 1024 * 1024
    };

    function formatSize(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function generateFileId() {
      return Date.now() + '-' + Math.random().toString(36).substr(2, 8);
    }

    function escapeClientHtml(str) {
      return String(str).replace(/[&<>"']/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        if (m === '"') return '&quot;';
        if (m === "'") return '&#39;';
        return m;
      });
    }

    function formatRemainingTime(ms) {
      if (ms <= 0) return '已到期';

      const units = [
        { label: '天', value: 24 * 60 * 60 * 1000 },
        { label: '小时', value: 60 * 60 * 1000 },
        { label: '分钟', value: 60 * 1000 },
        { label: '秒', value: 1000 }
      ];
      const parts = [];
      let remaining = ms;

      for (const unit of units) {
        if (parts.length >= 2) break;
        const amount = Math.floor(remaining / unit.value);
        if (amount > 0 || (parts.length > 0 && unit.label === '秒')) {
          parts.push(amount + unit.label);
          remaining -= amount * unit.value;
        }
      }

      if (parts.length === 0) {
        return '少于1秒';
      }

      return '剩余 ' + parts.join(' ');
    }

    function renderExpiryBadge(fileId, expireTime) {
      const badge = document.getElementById('expire-' + fileId);
      if (!badge) return;

      badge.classList.remove('hidden', 'urgent', 'expired');

      if (!expireTime) {
        badge.textContent = '永久有效';
        return;
      }

      const remaining = expireTime - Date.now();
      badge.textContent = formatRemainingTime(remaining);

      if (remaining <= 0) {
        badge.classList.add('expired');
      } else if (remaining <= 24 * 60 * 60 * 1000) {
        badge.classList.add('urgent');
      }
    }

    function refreshExpiryBadges() {
      if (fileExpiryMap.size === 0) {
        if (expiryRefreshTimer) {
          clearInterval(expiryRefreshTimer);
          expiryRefreshTimer = null;
        }
        return;
      }

      for (const [fileId, expireTime] of fileExpiryMap.entries()) {
        renderExpiryBadge(fileId, expireTime);
      }
    }

    function registerFileExpiry(fileId, expireTime) {
      if (!expireTime) {
        renderExpiryBadge(fileId, 0);
        return;
      }

      fileExpiryMap.set(fileId, expireTime);
      renderExpiryBadge(fileId, expireTime);

      if (!expiryRefreshTimer) {
        expiryRefreshTimer = setInterval(refreshExpiryBadges, 1000);
      }
    }

    function unregisterFileExpiry(fileId) {
      fileExpiryMap.delete(fileId);
      refreshExpiryBadges();
    }

    function showToast(message, type = 'info') {
      const toast = document.createElement('div');
      toast.className = 'toast ' + type;
      toast.textContent = message;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }

    function generateQRCode(text, container, options = {}) {
      if (!container) return;
      container.innerHTML = '';
      if (!text) return;
      try {
        const qr = qrcode(0, 'M');
        qr.addData(text);
        qr.make();
        const cellSize = options.cellSize || 4;
        const margin = options.margin || 2;
        const displaySize = options.displaySize || 80;
        const size = qr.getModuleCount() * cellSize + margin * 2;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        canvas.style.width = displaySize + 'px';
        canvas.style.height = displaySize + 'px';
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#000000';
        for (let row = 0; row < qr.getModuleCount(); row++) {
          for (let col = 0; col < qr.getModuleCount(); col++) {
            if (qr.isDark(row, col)) {
              ctx.fillRect(
                col * cellSize + margin,
                row * cellSize + margin,
                cellSize,
                cellSize
              );
            }
          }
        }
        canvas.className = 'qr-canvas';
        container.appendChild(canvas);
      } catch (err) {
        console.error('QR生成失败', err);
        container.innerHTML = '<span class="text-muted">❌ 二维码失败</span>';
      }
    }

    async function copyToClipboard(text, successMsg = '链接已复制') {
      try {
        await navigator.clipboard.writeText(text);
        showToast(successMsg, 'success');
      } catch (err) {
        showToast('复制失败，请手动复制', 'error');
      }
    }

    function openQrModal(fileName, downloadUrl) {
      const modal = document.getElementById('qrShareModal');
      const title = document.getElementById('qrModalTitle');
      const canvas = document.getElementById('qrModalCanvas');
      if (!modal || !title || !canvas) return;

      title.textContent = fileName || '文件分享二维码';
      modal.dataset.url = downloadUrl;
      generateQRCode(downloadUrl, canvas, {
        cellSize: 7,
        margin: 10,
        displaySize: 172
      });
      modal.classList.remove('hidden');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    function closeQrModal() {
      const modal = document.getElementById('qrShareModal');
      if (!modal) return;
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
      modal.dataset.url = '';
      document.body.style.overflow = '';
    }

    function setupQrModal() {
      const modal = document.getElementById('qrShareModal');
      const closeBtn = document.getElementById('qrModalClose');
      const copyCard = document.getElementById('qrModalCopyCard');
      if (!modal || !closeBtn || !copyCard || modal.dataset.bound === '1') return;

      closeBtn.addEventListener('click', closeQrModal);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeQrModal();
      });
      copyCard.addEventListener('click', () => {
        const url = modal.dataset.url;
        if (url) copyToClipboard(url, '分享链接已复制');
      });
      copyCard.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const url = modal.dataset.url;
          if (url) copyToClipboard(url, '分享链接已复制');
        }
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
          closeQrModal();
        }
      });

      modal.dataset.bound = '1';
    }

    function openDeleteModal(fileId) {
      const itemDiv = fileItemsMap.get(fileId);
      const modal = document.getElementById('deleteConfirmModal');
      const desc = document.getElementById('deleteModalDesc');
      const confirmBtn = document.getElementById('deleteModalConfirm');
      const cancelBtn = document.getElementById('deleteModalCancel');
      if (!itemDiv || !modal || !desc || !confirmBtn || !cancelBtn) return;

      deleteModalState.fileId = fileId;
      deleteModalState.busy = false;
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
      confirmBtn.textContent = '确认删除';
      const fileName = itemDiv.dataset.fileName || '该文件';
      desc.textContent = '确认删除 "' + fileName + '" 吗？删除后将从存储桶中移除，且无法恢复。';
      modal.classList.remove('hidden');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    function closeDeleteModal(force = false) {
      const modal = document.getElementById('deleteConfirmModal');
      if (!modal) return;
      if (deleteModalState.busy && !force) return;
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
      deleteModalState.fileId = '';
      deleteModalState.busy = false;
      document.body.style.overflow = '';
    }

    function setupDeleteModal() {
      const modal = document.getElementById('deleteConfirmModal');
      const confirmBtn = document.getElementById('deleteModalConfirm');
      const cancelBtn = document.getElementById('deleteModalCancel');
      if (!modal || !confirmBtn || !cancelBtn || modal.dataset.bound === '1') return;

      cancelBtn.addEventListener('click', () => {
        closeDeleteModal();
      });
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeDeleteModal();
      });
      confirmBtn.addEventListener('click', async () => {
        if (!deleteModalState.fileId || deleteModalState.busy) return;
        deleteModalState.busy = true;
        confirmBtn.disabled = true;
        cancelBtn.disabled = true;
        confirmBtn.textContent = '删除中...';
        await deleteUploadedFile(deleteModalState.fileId);
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
          closeDeleteModal();
        }
      });

      modal.dataset.bound = '1';
    }

    function setResultActionsDisabled(fileId, disabled) {
      const itemDiv = fileItemsMap.get(fileId);
      if (!itemDiv) return;
      itemDiv.querySelectorAll('.btn-qr, .btn-delete, .btn-download').forEach((btn) => {
        btn.disabled = disabled;
      });
    }

    function updateUploadCountBadge() {
      const items = document.querySelectorAll('.file-item');
      const badge = document.getElementById('uploadCountBadge');
      if (badge) badge.innerText = items.length ? String(items.length) : '';
      
      // 处理空状态显示
      const listContainer = document.getElementById('fileItemsList');
      const emptyState = listContainer.querySelector('.empty-state');
      
      if (items.length === 0) {
        if (!emptyState) {
          listContainer.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📂</div><div>暂无上传文件，请选择文件开始</div></div>';
        }
      } else if (emptyState) {
        emptyState.remove();
      }
    }

    function createFileItemDOM(file, fileId) {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'file-item';
      itemDiv.dataset.fileId = fileId;
      const fileSize = formatSize(file.size);
      const safeFileName = escapeClientHtml(file.name);
      const headerHtml = '<div class="file-item-header"><span class="file-name" title="' + safeFileName + '">' + safeFileName + '</span><div class="file-meta-group"><span class="file-expire hidden" id="expire-' + fileId + '"></span><span class="file-size">' + fileSize + '</span></div><span class="file-status" id="status-' + fileId + '">等待中</span></div><div class="progress-bar-container" id="progressContainer-' + fileId + '"><div class="progress-bar-fill" id="progressFill-' + fileId + '" style="width:0%"></div></div>';
      itemDiv.innerHTML = headerHtml;
      const resultDiv = document.createElement('div');
      resultDiv.id = 'result-' + fileId;
      resultDiv.className = 'file-result';
      resultDiv.style.display = 'none';
      itemDiv.appendChild(resultDiv);
      return itemDiv;
    }

    function updateFileStatus(fileId, statusText, statusType = 'uploading') {
      const statusSpan = document.getElementById('status-' + fileId);
      if (statusSpan) {
        statusSpan.innerText = statusText;
        statusSpan.className = 'file-status ' + statusType;
      }
    }

    function updateProgress(fileId, percent) {
      const fill = document.getElementById('progressFill-' + fileId);
      if (fill) fill.style.width = percent + '%';
    }

    async function deleteUploadedFile(fileId) {
      const itemDiv = fileItemsMap.get(fileId);
      if (!itemDiv) return;

      const serverFileId = itemDiv.dataset.serverFileId;
      if (!serverFileId) {
        closeDeleteModal(true);
        showToast('文件尚未上传完成，暂时无法删除', 'error');
        return;
      }

      const statusSpan = document.getElementById('status-' + fileId);
      const previousStatusText = statusSpan ? statusSpan.innerText : '';
      const previousStatusClass = statusSpan ? statusSpan.className : '';
      const deleteBtn = itemDiv.querySelector('.btn-delete');

      setResultActionsDisabled(fileId, true);
      if (deleteBtn) deleteBtn.innerText = '删除中...';
      updateFileStatus(fileId, '删除中...', 'uploading');

      try {
        const res = await fetch('/api/file/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId: serverFileId })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error) {
          throw new Error(data.error || '删除失败');
        }

        unregisterFileExpiry(fileId);
        fileItemsMap.delete(fileId);
        itemDiv.remove();
        updateUploadCountBadge();
        closeDeleteModal(true);
        await refreshStorageInfo();
        showToast('文件已从存储桶中移除', 'success');
      } catch (err) {
        if (statusSpan) {
          statusSpan.innerText = previousStatusText;
          statusSpan.className = previousStatusClass;
        }
        setResultActionsDisabled(fileId, false);
        if (deleteBtn) deleteBtn.innerText = '🗑 删除';
        deleteModalState.busy = false;
        const confirmBtn = document.getElementById('deleteModalConfirm');
        const cancelBtn = document.getElementById('deleteModalCancel');
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.textContent = '确认删除';
        }
        if (cancelBtn) cancelBtn.disabled = false;
        showToast('删除失败: ' + err.message, 'error');
      }
    }

    function createHistoryItem(record) {
      const localFileId = 'remote-' + record.fileId;
      if (fileItemsMap.has(localFileId)) return;

      const listContainer = document.getElementById('fileItemsList');
      if (!listContainer) return;

      const itemDom = createFileItemDOM({
        name: record.filename,
        size: record.size
      }, localFileId);
      listContainer.appendChild(itemDom);
      fileItemsMap.set(localFileId, itemDom);
      updateFileStatus(localFileId, '✅ 成功', 'success');
      updateProgress(localFileId, 100);
      showUploadResult(localFileId, {
        serverFileId: record.fileId,
        downloadUrl: record.downloadUrl,
        fileName: record.filename,
        hasPassword: record.hasPassword,
        expireTime: record.expireTime
      });
    }

    function updateStorageStats(summary) {
      if (!summary) return;
      storageState = {
        limitBytes: summary.limitBytes || storageState.limitBytes,
        usedBytes: summary.usedBytes || 0,
        remainingBytes: summary.remainingBytes || 0
      };

      const el = document.getElementById('storageRemainingValue');
      if (el) {
        el.textContent = formatSize(storageState.remainingBytes);
      }
    }

    async function refreshStorageInfo() {
      try {
        const res = await fetch('/api/storage');
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error) {
          throw new Error(data.error || '读取存储信息失败');
        }
        updateStorageStats(data);
      } catch (err) {
        console.error('读取存储信息失败', err);
      }
    }

    async function loadExistingFiles() {
      try {
        const res = await fetch('/api/files');
        const data = await res.json().catch(() => ({ files: [] }));
        if (!res.ok || data.error) {
          throw new Error(data.error || '读取上传记录失败');
        }

        updateStorageStats(data.storage || null);
        const files = Array.isArray(data.files) ? data.files : [];
        files.sort((a, b) => (b.uploadTime || 0) - (a.uploadTime || 0));
        for (const file of files) {
          createHistoryItem(file);
        }
      } catch (err) {
        console.error('读取历史记录失败', err);
        showToast('上传记录读取失败，刷新页面可重试', 'error');
      } finally {
        updateUploadCountBadge();
      }
    }

    function showUploadResult(fileId, options) {
      const resultDiv = document.getElementById('result-' + fileId);
      if (!resultDiv) return;
      const progressContainer = document.getElementById('progressContainer-' + fileId);
      if (progressContainer) progressContainer.style.display = 'none';

      const itemDiv = fileItemsMap.get(fileId);
      const { serverFileId, downloadUrl, fileName, hasPassword, expireTime } = options;
      if (itemDiv) {
        itemDiv.dataset.serverFileId = serverFileId || '';
        itemDiv.dataset.downloadUrl = downloadUrl || '';
        itemDiv.dataset.fileName = fileName || '';
      }

      const passwordBadge = hasPassword ? '<span class="password-badge">🔒 密码保护</span>' : '';
      const safeUrl = escapeClientHtml(downloadUrl || '');
      resultDiv.innerHTML = '<div class="file-result-link"><input class="download-link-input" type="text" readonly value="' + safeUrl + '"></div><div class="file-result-actions"><button class="btn-sm btn-download" type="button">⬇ 下载</button><button class="btn-sm btn-qr" type="button">🔗 分享</button><button class="btn-sm btn-delete" type="button">🗑 删除</button></div>' + passwordBadge;
      resultDiv.style.display = 'flex';
      resultDiv.style.flexWrap = '';

      registerFileExpiry(fileId, expireTime);

      const linkInput = resultDiv.querySelector('.download-link-input');
      if (linkInput) {
        linkInput.addEventListener('click', () => {
          linkInput.select();
        });
      }

      const dlBtn = resultDiv.querySelector('.btn-download');
      if (dlBtn) {
        dlBtn.addEventListener('click', () => {
          // 直接打开分享链接：无密码文件直接触发下载，有密码文件显示密码输入页
          window.open(downloadUrl, '_blank');
        });
      }

      const qrBtn = resultDiv.querySelector('.btn-qr');
      if (qrBtn) {
        qrBtn.addEventListener('click', () => {
          openQrModal(fileName, downloadUrl);
        });
      }

      const deleteBtn = resultDiv.querySelector('.btn-delete');
      if (deleteBtn) {
        deleteBtn.innerText = '🗑 删除';
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (deleteBtn.disabled) return;
          openDeleteModal(fileId);
        });
      }
    }

    // 上传单个分片（带重试）
    async function uploadChunk(fileId, chunk, chunkIndex, totalChunks, retries = 3) {
      const formData = new FormData();
      formData.append('chunk', chunk);

      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const res = await fetch('/api/multipart/upload?fileId=' + fileId + '&chunkIndex=' + chunkIndex, {
            method: 'POST',
            body: chunk
          });

          if (!res.ok) {
            const error = await res.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || '上传失败');
          }

          const data = await res.json();
          return data;
        } catch (err) {
          if (attempt === retries - 1) throw err;
          // 等待后重试（指数退避）
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }
    }

    // 分片上传
    async function uploadFileMultipart(file, fileId, sharePassword, serverFileId) {
      const chunkSize = CONFIG.CHUNK_SIZE || 50 * 1024 * 1024;
      const totalChunks = Math.ceil(file.size / chunkSize);

      updateFileStatus(fileId, '初始化分片...', 'uploading');

      // 初始化分片上传
      const initRes = await fetch('/api/multipart/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: serverFileId,
          totalChunks: totalChunks
        })
      });

      if (!initRes.ok) {
        throw new Error('初始化分片上传失败');
      }

      // 上传所有分片
      let uploadedChunks = 0;
      const maxConcurrent = 2; // 同时上传的分片数
      const chunks = [];

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        chunks.push({
          index: i,
          blob: file.slice(start, end)
        });
      }

      // 并发上传控制
      const uploadChunkBatch = async (batch) => {
        await Promise.all(batch.map(async (chunkInfo) => {
          try {
            await uploadChunk(serverFileId, chunkInfo.blob, chunkInfo.index, totalChunks);
            uploadedChunks++;
            const percent = (uploadedChunks / totalChunks * 100).toFixed(1);
            updateProgress(fileId, percent);
            updateFileStatus(fileId, '分片 ' + uploadedChunks + '/' + totalChunks, 'uploading');
          } catch (err) {
            throw new Error('分片 ' + chunkInfo.index + ' 上传失败: ' + err.message);
          }
        }));
      };

      // 分批上传
      for (let i = 0; i < chunks.length; i += maxConcurrent) {
        const batch = chunks.slice(i, i + maxConcurrent);
        await uploadChunkBatch(batch);
      }

      // 完成分片上传
      updateFileStatus(fileId, '合并分片...', 'uploading');
      const completeRes = await fetch('/api/multipart/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: serverFileId })
      });

      if (!completeRes.ok) {
        const error = await completeRes.json().catch(() => ({ error: '合并失败' }));
        throw new Error(error.error || '合并分片失败');
      }

      return await completeRes.json();
    }

    // 取消分片上传
    async function abortMultipartUpload(serverFileId) {
      try {
        await fetch('/api/multipart/abort', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId: serverFileId })
        });
      } catch (e) {
        console.error('取消上传失败:', e);
      }
    }

    async function uploadFile(file, fileId, sharePassword) {
      const container = document.getElementById('progressContainer-' + fileId);
      if (!container) return;
      updateFileStatus(fileId, '检查中...', 'uploading');

      if (file.size > CONFIG.MAX_FILE_SIZE) {
        updateFileStatus(fileId, '过大 (' + formatSize(file.size) + ')', 'error');
        showToast(file.name + ' 超过限制', 'error');
        return;
      }
      if (CONFIG.ALLOWED_TYPES.length > 0 && !CONFIG.ALLOWED_TYPES.includes(file.type)) {
        updateFileStatus(fileId, '不支持类型', 'error');
        showToast(file.name + ' 文件类型不允许', 'error');
        return;
      }

      let serverFileId = null;

      try {
        updateFileStatus(fileId, '获取上传凭证...', 'uploading');
        const res = await fetch('/api/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            size: file.size,
            type: file.type,
            password: sharePassword || null
          })
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || '获取上传链接失败');

        const { uploadUrl, downloadUrl, hasPassword, useMultipart, expireTime } = data;
        serverFileId = data.fileId;

        if (useMultipart) {
          // 分片上传（大文件）
          const result = await uploadFileMultipart(file, fileId, sharePassword, serverFileId);
          updateFileStatus(fileId, '✅ 成功', 'success');
          updateProgress(fileId, 100);
          showUploadResult(fileId, {
            serverFileId: serverFileId,
            downloadUrl: result.downloadUrl || downloadUrl,
            fileName: file.name,
            hasPassword: hasPassword,
            expireTime: expireTime
          });
          await refreshStorageInfo();
          showToast(file.name + ' 上传成功', 'success');
        } else {
          // 直接上传（小文件）
          updateFileStatus(fileId, '上传中...', 'uploading');

          await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                const percent = (e.loaded / e.total * 100).toFixed(1);
                updateProgress(fileId, percent);
              }
            };
            xhr.onload = () => {
              if (xhr.status === 200) resolve();
              else reject(new Error('上传失败 ' + xhr.status));
            };
            xhr.onerror = () => reject(new Error('网络错误'));
            xhr.ontimeout = () => reject(new Error('上传超时'));
            xhr.timeout = 300000; // 5分钟超时
            xhr.open('PUT', uploadUrl, true);
            xhr.setRequestHeader('Content-Type', file.type);
            xhr.send(file);
          });

          updateFileStatus(fileId, '✅ 成功', 'success');
          updateProgress(fileId, 100);
          showUploadResult(fileId, {
            serverFileId: serverFileId,
            downloadUrl: downloadUrl,
            fileName: file.name,
            hasPassword: hasPassword,
            expireTime: expireTime
          });
          await refreshStorageInfo();
          showToast(file.name + ' 上传成功', 'success');
        }
      } catch (err) {
        console.error(err);
        updateFileStatus(fileId, '❌ 失败: ' + err.message, 'error');
        await refreshStorageInfo();
        showToast(file.name + ' 上传失败: ' + err.message, 'error');

        // 如果是分片上传失败，尝试取消
        if (serverFileId) {
          await abortMultipartUpload(serverFileId);
        }
      } finally {
        activeUploads--;
        processQueue();
      }
    }

    function processQueue() {
      if (pendingQueue.length === 0) return;
      while (activeUploads < CONFIG.MAX_CONCURRENT_UPLOADS && pendingQueue.length > 0) {
        const { file, fileId, password } = pendingQueue.shift();
        activeUploads++;
        uploadFile(file, fileId, password);
      }
    }

    function addFilesToQueue(files, sharePassword) {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;
      if (storageState.remainingBytes <= 0) {
        showToast('存储空间已满，暂时无法上传新文件', 'error');
        return;
      }
      const listContainer = document.getElementById('fileItemsList');
      if (!listContainer) return;
      const emptyHint = listContainer.querySelector('.text-muted');
      if (emptyHint && emptyHint.style.display !== 'none') emptyHint.style.display = 'none';
      let availableBytes = storageState.remainingBytes;
      
      for (const file of fileArray) {
        if (file.size > availableBytes) {
          showToast(file.name + ' 超过当前剩余存储空间', 'error');
          continue;
        }
        const fileId = generateFileId();
        const itemDom = createFileItemDOM(file, fileId);
        listContainer.appendChild(itemDom);
        fileItemsMap.set(fileId, itemDom);
        pendingQueue.push({ file, fileId, password: sharePassword });
        availableBytes -= file.size;
      }
      updateUploadCountBadge();
      processQueue();
    }

    function setupUpload() {
      const area = document.getElementById('uploadArea');
      const fileInput = document.getElementById('fileInput');
      const sharePasswordInput = document.getElementById('sharePasswordInput');
      if (!area || !fileInput) return;
      
      area.onclick = () => fileInput.click();
      area.ondragover = (e) => { e.preventDefault(); area.classList.add('dragover'); };
      area.ondragleave = () => area.classList.remove('dragover');
      area.ondrop = (e) => {
        e.preventDefault();
        area.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
          const password = sharePasswordInput ? sharePasswordInput.value : '';
          addFilesToQueue(e.dataTransfer.files, password);
        }
      };
      fileInput.onchange = (e) => {
        if (e.target.files.length) {
          const password = sharePasswordInput ? sharePasswordInput.value : '';
          addFilesToQueue(e.target.files, password);
        }
        fileInput.value = '';
      };
    }

    function showLoginModal() {
      document.getElementById('passwordModal').classList.remove('hidden');
    }

    function applySiteBackground() {
      const cfg = (typeof window.__SITE_CFG__ === 'object' && window.__SITE_CFG__) || {};
      const bgUrl = (cfg.bgUrl || '').trim();
      if (!bgUrl) return;
      const safeUrl = bgUrl.replace(/[^a-zA-Z0-9:/._~?&=%-]/g, '');
      document.body.style.backgroundImage =
        'linear-gradient(rgba(10,10,15,0.82), rgba(10,10,15,0.82)), url("' + safeUrl + '")';
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundAttachment = 'fixed';
    }

    async function loadSiteConfig() {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        window.__SITE_CFG__ = { bgUrl: data.bgUrl || '', authUser: data.authUser || '' };
        applySiteBackground();
      } catch (e) { /* 忽略 */ }
    }

    function setupLogoutButton() {
      const btn = document.getElementById('logoutBtn');
      if (!btn || btn.dataset.bound === '1') return;
      btn.addEventListener('click', async () => {
        try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (e) {}
        location.reload();
      });
      btn.dataset.bound = '1';
    }

    function setupSettingsModal() {
      const modal = document.getElementById('settingsModal');
      const btn = document.getElementById('settingsBtn');
      if (!modal || !btn || modal.dataset.bound === '1') return;

      setupLogoutButton();

      btn.addEventListener('click', async () => {
        await loadSiteConfig();
        const cfg = window.__SITE_CFG__ || {};
        document.getElementById('setAuthUser').value = cfg.authUser || '';
        document.getElementById('setNewPassword').value = '';
        document.getElementById('setBgUrl').value = cfg.bgUrl || '';
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
      });

      document.getElementById('settingsCloseBtn').addEventListener('click', () => {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
      });

      document.getElementById('settingsSaveBtn').addEventListener('click', async () => {
        const saveBtn = document.getElementById('settingsSaveBtn');
        const userVal = document.getElementById('setAuthUser').value.trim();
        const passVal = document.getElementById('setNewPassword').value;
        const bgVal = document.getElementById('setBgUrl').value.trim();
        if (!userVal) { showToast('账号不能为空', 'error'); return; }
        if (passVal && passVal.length < 4) { showToast('密码至少 4 位', 'error'); return; }
        saveBtn.disabled = true;
        saveBtn.textContent = '保存中...';
        try {
          const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ authUser: userVal, newPassword: passVal || undefined, bgUrl: bgVal })
          });
          const data = await res.json();
          if (!res.ok || data.error) throw new Error(data.error || '保存失败');
          window.__SITE_CFG__ = { bgUrl: data.bgUrl || '', authUser: data.authUser || userVal };
          applySiteBackground();
          showToast('设置已保存', 'success');
          modal.classList.add('hidden');
          document.body.style.overflow = '';
        } catch (err) {
          showToast('保存失败: ' + err.message, 'error');
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = '保存设置';
        }
      });

      modal.dataset.bound = '1';
    }

    window.verifyPassword = async function() {
      const input = document.getElementById('passwordInput');
      const userInput = document.getElementById('loginUsername');
      const password = input.value;
      const username = userInput ? userInput.value.trim() : '';
      if (!username || !password) {
        showToast('请输入账号和密码', 'error');
        return;
      }
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success) {
          document.getElementById('passwordModal').classList.add('hidden');
          initApp();
          applySiteBackground();
        } else {
          showToast(data.error || '账号或密码错误', 'error');
        }
      } catch (e) {
        showToast('验证失败', 'error');
      }
    };

    async function initApp() {
      setupQrModal();
      setupDeleteModal();
      setupUpload();
      await loadExistingFiles();
      await refreshStorageInfo();
      updateUploadCountBadge();
    }

    document.addEventListener('DOMContentLoaded', () => {
      setupSettingsModal();
      const pwInput = document.getElementById('passwordInput');
      const userInput = document.getElementById('loginUsername');
      if (pwInput) {
        pwInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') verifyPassword(); });
      }
      if (userInput) {
        userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') document.getElementById('passwordInput').focus(); });
      }
      // 背景配置始终加载（登录页也需要背景）
      loadSiteConfig();
      if (window.__AUTH_REQUIRED__ && !window.__LOGGED_IN__) {
        showLoginModal();
      } else {
        initApp();
      }
    });
  </script>
</body>
</html>`;

// 主页 HTML 生成：根据登录状态注入标记（认证体系全局化后始终要求登录）
function getIndexHtml(loggedIn) {
  return HTML_TEMPLATE
    .replace('<script>\n    const CONFIG = ', '<script>\n    window.__AUTH_REQUIRED__ = true;\n    window.__LOGGED_IN__ = ' + !!loggedIn + ';\n    const CONFIG = ');
}

// ==================== 工具函数 ====================

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function sanitizeFilename(filename) {
  return filename.replace(/[<>:\"/\\|?*\x00-\x1f]/g, '_').trim();
}

// ==================== 密码哈希工具 ====================
async function hashPassword(password, salt) {
  if (!password) return null;
  const encoder = new TextEncoder();
  // 确保密码和 salt 都是字符串
  const passwordStr = String(password).trim();
  const saltStr = String(salt);
  const data = encoder.encode(passwordStr + saltStr);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateSalt() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

// ==================== 签名工具（临时下载链接）====================
function getSecretKey(env) {
  const secret = CONFIG.SHARE_SECRET_KEY || env.SHARE_SECRET_KEY || 'default-secret-key-change-in-production';
  return secret;
}

async function generateTempToken(fileId, expires, env) {
  const secret = getSecretKey(env);
  const data = `${fileId}:${expires}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
  const signatureHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
  return signatureHex;
}

async function verifyTempToken(fileId, expires, token, env) {
  const expected = await generateTempToken(fileId, expires, env);
  return token === expected && parseInt(expires) > Date.now();
}

// ==================== 密码验证页面HTML ====================
function getPasswordPromptHtml(fileId, fileName) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>文件加密 - 请输入密码</title>
  <style>
    :root {
      --bg-primary: #0a0a0f;
      --bg-secondary: #12121a;
      --bg-card: rgba(30, 30, 45, 0.6);
      --border-color: rgba(255, 255, 255, 0.1);
      --text-primary: #ffffff;
      --text-secondary: #a0a0b0;
      --accent-purple: #8b5cf6;
      --accent-blue: #3b82f6;
      --accent-cyan: #06b6d4;
      --accent-pink: #ec4899;
      --success: #10b981;
      --error: #ef4444;
      --warning: #f59e0b;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-primary);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      color: var(--text-primary);
      background-image:
        radial-gradient(ellipse at 20% 20%, rgba(139, 92, 246, 0.15) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 80%, rgba(6, 182, 212, 0.1) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 50%, rgba(59, 130, 246, 0.05) 0%, transparent 70%);
    }

    .container {
      width: 100%;
      max-width: 450px;
    }

    .card {
      background: var(--bg-card);
      backdrop-filter: blur(20px);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      padding: 40px;
      text-align: center;
      transition: all 0.3s ease;
    }

    .card:hover {
      border-color: rgba(139, 92, 246, 0.2);
    }

    .icon {
      font-size: 64px;
      margin-bottom: 20px;
    }

    h2 {
      font-size: 1.75rem;
      font-weight: 700;
      background: linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-cyan) 50%, var(--accent-pink) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 8px;
      letter-spacing: -0.02em;
    }

    .subtitle {
      color: var(--text-secondary);
      font-size: 14px;
      margin-bottom: 24px;
    }

    .file-name {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--border-color);
      padding: 14px;
      border-radius: 12px;
      margin: 20px 0;
      word-break: break-all;
      font-size: 14px;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    input {
      width: 100%;
      padding: 14px 18px;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      font-size: 16px;
      color: var(--text-primary);
      margin-bottom: 20px;
      transition: all 0.2s ease;
    }

    input:focus {
      outline: none;
      border-color: var(--accent-purple);
      box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);
    }

    input::placeholder {
      color: var(--text-secondary);
    }

    button {
      width: 100%;
      padding: 16px 24px;
      background: linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-blue) 100%);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(139, 92, 246, 0.4);
    }

    .error {
      color: var(--error);
      font-size: 14px;
      margin-top: 16px;
      padding: 14px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      border-radius: 10px;
      display: none;
    }

    .hint {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 16px;
    }

    @media (max-width: 640px) {
      body { padding: 16px; }
      .card { padding: 28px; }
      h2 { font-size: 1.5rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="icon">🔐</div>
      <h2>文件已加密</h2>
      <p class="subtitle">此文件设置了分享密码</p>
      <div class="file-name">📄 ${escapeHtml(fileName)}</div>
      <input type="password" id="passwordInput" placeholder="请输入分享密码" autofocus>
      <button onclick="verify()">验证并下载</button>
      <div id="errorMsg" class="error">密码错误，请重试</div>
      <div class="hint">请输入密码后下载文件</div>
    </div>
  </div>
  <script>
    async function verify() {
      const password = document.getElementById('passwordInput').value;
      const errorEl = document.getElementById('errorMsg');
      if (!password || !password.trim()) {
        errorEl.style.display = 'block';
        errorEl.textContent = '请输入密码';
        return;
      }
      try {
        const res = await fetch('/d/${fileId}/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: password.trim() })
        });
        const data = await res.json();
        if (data.success && data.downloadUrl) {
          window.location.href = data.downloadUrl;
        } else {
          errorEl.style.display = 'block';
          errorEl.textContent = data.error || '密码错误';
        }
      } catch (err) {
        errorEl.style.display = 'block';
        errorEl.textContent = '验证失败，请重试';
      }
    }
    document.getElementById('passwordInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') verify();
    });
  </script>
</body>
</html>`;
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    if (m === '"') return '&quot;';
    if (m === "'") return '&#39;';
    return m;
  });
}

// ==================== 文件详情页HTML ====================
function getFileDetailHtml(fileId, fileName, fileSize, hasPassword, uploadTime) {
  const formattedSize = formatSize(fileSize);
  const formattedTime = uploadTime ? new Date(uploadTime).toLocaleString('zh-CN') : '未知';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>文件详情 - ${escapeHtml(fileName)}</title>
  <link rel="icon" href="${FAVICON_DATA_URL}">
  <style>
    :root {
      --bg-primary: #0a0a0f;
      --bg-secondary: #12121a;
      --bg-card: rgba(30, 30, 45, 0.6);
      --border-color: rgba(255, 255, 255, 0.1);
      --text-primary: #ffffff;
      --text-secondary: #a0a0b0;
      --accent-purple: #8b5cf6;
      --accent-blue: #3b82f6;
      --accent-cyan: #06b6d4;
      --accent-pink: #ec4899;
      --success: #10b981;
      --error: #ef4444;
      --warning: #f59e0b;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-primary);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      color: var(--text-primary);
      background-image:
        radial-gradient(ellipse at 20% 20%, rgba(139, 92, 246, 0.15) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 80%, rgba(6, 182, 212, 0.1) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 50%, rgba(59, 130, 246, 0.05) 0%, transparent 70%);
    }

    .container {
      width: 100%;
      max-width: 520px;
    }

    .card {
      background: var(--bg-card);
      backdrop-filter: blur(20px);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      padding: 40px;
      text-align: center;
      transition: all 0.3s ease;
    }

    .card:hover {
      border-color: rgba(139, 92, 246, 0.2);
    }

    .icon {
      font-size: 64px;
      margin-bottom: 20px;
      background: linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-cyan) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    h2 {
      font-size: 1.75rem;
      font-weight: 700;
      background: linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-cyan) 50%, var(--accent-pink) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 8px;
      letter-spacing: -0.02em;
    }

    .subtitle {
      color: var(--text-secondary);
      font-size: 14px;
      margin-bottom: 28px;
    }

    .file-info {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 20px;
      margin: 24px 0;
      text-align: left;
    }

    .file-name {
      font-weight: 600;
      color: var(--text-primary);
      word-break: break-all;
      font-size: 15px;
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .file-name::before {
      content: '📄';
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 12px 0;
      font-size: 14px;
    }

    .info-label {
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .info-value {
      color: var(--text-primary);
      font-weight: 500;
    }

    .password-section {
      margin: 20px 0;
      padding: 20px;
      background: rgba(245, 158, 11, 0.08);
      border: 1px solid rgba(245, 158, 11, 0.2);
      border-radius: 12px;
    }

    .password-icon {
      font-size: 32px;
      margin-bottom: 8px;
    }

    .password-text {
      color: var(--warning);
      font-size: 14px;
      margin-bottom: 12px;
    }

    input {
      width: 100%;
      padding: 14px 18px;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      font-size: 16px;
      color: var(--text-primary);
      transition: all 0.2s ease;
    }

    input:focus {
      outline: none;
      border-color: var(--accent-purple);
      box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);
    }

    input::placeholder {
      color: var(--text-secondary);
    }

    .download-btn {
      width: 100%;
      padding: 16px 24px;
      background: linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-blue) 100%);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 20px;
    }

    .download-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(139, 92, 246, 0.4);
    }

    .download-btn:disabled {
      background: rgba(255, 255, 255, 0.1);
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .error {
      color: var(--error);
      font-size: 14px;
      margin-top: 16px;
      padding: 14px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      border-radius: 10px;
      display: none;
    }

    .hint {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 16px;
    }

    .loading {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 3px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 1s ease-in-out infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @media (max-width: 640px) {
      body { padding: 16px; }
      .card { padding: 24px; }
      h2 { font-size: 1.5rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="icon">📦</div>
      <h2>文件分享</h2>
      <p class="subtitle">有人与您分享了一个文件</p>

      <div class="file-info">
        <div class="file-name">${escapeHtml(fileName)}</div>
        <div class="info-row">
          <span class="info-label">📊 文件大小</span>
          <span class="info-value">${formattedSize}</span>
        </div>
        <div class="info-row">
          <span class="info-label">📅 上传时间</span>
          <span class="info-value">${formattedTime}</span>
        </div>
        ${hasPassword ? `
        <div class="info-row">
          <span class="info-label">🔒 访问权限</span>
          <span class="info-value" style="color: var(--warning);">需要密码</span>
        </div>
        ` : `
        <div class="info-row">
          <span class="info-label">🔓 访问权限</span>
          <span class="info-value" style="color: var(--success);">公开访问</span>
        </div>
        `}
      </div>

      ${hasPassword ? `
      <div class="password-section">
        <div class="password-icon">🔐</div>
        <p class="password-text">此文件受密码保护，请输入密码</p>
        <input type="password" id="passwordInput" placeholder="请输入分享密码" autofocus>
      </div>
      ` : ''}

      <button class="download-btn" id="downloadBtn" onclick="handleDownload()">
        <span>⬇️</span>
        <span>下载文件</span>
      </button>

      <div id="errorMsg" class="error"></div>

      <p class="hint">文件将通过安全连接下载，请妥善保管分享链接</p>
    </div>
  </div>

  <script>
    async function handleDownload() {
      const btn = document.getElementById('downloadBtn');
      const errorEl = document.getElementById('errorMsg');
      ${hasPassword ? `
      const password = document.getElementById('passwordInput').value.trim();
      if (!password) {
        errorEl.style.display = 'block';
        errorEl.textContent = '请输入密码';
        document.getElementById('passwordInput').focus();
        return;
      }
      ` : 'const password = null;'}

      // 禁用按钮并显示加载状态
      btn.disabled = true;
      btn.innerHTML = '<span class="loading"></span><span>验证中...</span>';
      errorEl.style.display = 'none';

      try {
        const res = await fetch('/d/${fileId}/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const data = await res.json();

        if (data.success && data.downloadUrl) {
          btn.innerHTML = '<span>✅</span><span>即将开始下载...</span>';
          window.location.href = data.downloadUrl;
        } else {
          errorEl.style.display = 'block';
          errorEl.textContent = data.error || '验证失败，请重试';
          btn.disabled = false;
          btn.innerHTML = '<span>⬇️</span><span>下载文件</span>';
        }
      } catch (err) {
        errorEl.style.display = 'block';
        errorEl.textContent = '网络错误，请检查网络连接后重试';
        btn.disabled = false;
        btn.innerHTML = '<span>⬇️</span><span>下载文件</span>';
      }
    }

    ${hasPassword ? `
    document.getElementById('passwordInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleDownload();
    });
    ` : ''}
  </script>
</body>
</html>`;
}

// ==================== WebDAV 管理界面 ====================

function getWebDavUiHtml() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WebDAV 同步管理 | New File Transfer</title>
  <link rel="icon" href="${FAVICON_DATA_URL}">
  <style>
    :root {
      --bg-primary: #0a0a0f;
      --bg-card: rgba(30, 30, 45, 0.6);
      --border-color: rgba(255, 255, 255, 0.1);
      --text-primary: #ffffff;
      --text-secondary: #a0a0b0;
      --accent-purple: #8b5cf6;
      --accent-cyan: #06b6d4;
      --accent-pink: #ec4899;
      --success: #10b981;
      --error: #ef4444;
      --warning: #f59e0b;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-primary);
      min-height: 100vh;
      padding: 24px;
      color: var(--text-primary);
      background-image:
        radial-gradient(ellipse at 20% 20%, rgba(139, 92, 246, 0.15) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 80%, rgba(6, 182, 212, 0.1) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 50%, rgba(59, 130, 246, 0.05) 0%, transparent 70%);
    }
    .container { max-width: 1000px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 32px; padding: 20px 0; }
    .header h1 {
      font-size: 2.5rem; font-weight: 700; margin-bottom: 8px; letter-spacing: -0.02em;
      background: linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-purple) 50%, var(--accent-pink) 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    }
    .header p { color: var(--text-secondary); font-size: 1rem; }
    .header a.back-link {
      display: inline-flex; align-items: center; gap: 6px; margin-top: 12px;
      color: var(--accent-cyan); font-size: 13px; text-decoration: none;
      border: 1px solid rgba(6,182,212,0.35); background: rgba(6,182,212,0.08);
      padding: 7px 16px; border-radius: 20px; transition: all 0.2s ease;
    }
    .header a.back-link:hover { background: rgba(6,182,212,0.16); }

    .card {
      background: var(--bg-card); backdrop-filter: blur(20px);
      border: 1px solid var(--border-color); border-radius: 20px;
      padding: 24px; margin-bottom: 20px;
    }
    .toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 18px; }
    .btn {
      padding: 9px 16px; font-size: 13px; border: none; border-radius: 10px;
      cursor: pointer; font-weight: 500; display: inline-flex; align-items: center; gap: 6px;
      transition: all 0.2s ease; color: #fff;
    }
    .btn:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,0,0,0.3); }
    .btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; box-shadow: none; }
    .btn-mkdir { background: var(--accent-purple); }
    .btn-upload { background: var(--accent-blue, #3b82f6); }
    .btn-refresh { background: rgba(255,255,255,0.10); }
    .btn-logout { background: rgba(239,68,68,0.16); color: #fca5a5; }
    .toolbar input[type="text"] {
      flex: 1 1 220px; padding: 9px 14px; font-size: 13px;
      background: rgba(0,0,0,0.35); border: 1px solid var(--border-color);
      border-radius: 10px; color: var(--text-primary);
    }
    .toolbar input[type="text"]:focus { outline: none; border-color: var(--accent-cyan); }

    /* 面包屑 */
    .breadcrumb { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 16px; font-size: 14px; }
    .breadcrumb a { color: var(--accent-cyan); text-decoration: none; padding: 3px 8px; border-radius: 8px; }
    .breadcrumb a:hover { background: rgba(6,182,212,0.12); }
    .breadcrumb .sep { color: var(--text-secondary); opacity: 0.6; }
    .breadcrumb .current { color: var(--text-primary); padding: 3px 8px; font-weight: 600; }

    /* 文件表格 */
    .file-table { width: 100%; border-collapse: collapse; }
    .file-table th {
      text-align: left; font-size: 12px; color: var(--text-secondary);
      text-transform: uppercase; letter-spacing: 0.05em;
      padding: 10px 12px; border-bottom: 1px solid var(--border-color);
    }
    .file-table td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 14px; }
    .file-table tr.row { cursor: pointer; transition: background 0.15s ease; }
    .file-table tr.row:hover { background: rgba(139,92,246,0.07); }
    .file-table .icon { width: 30px; font-size: 18px; }
    .file-table .name { word-break: break-all; color: var(--text-primary); }
    .file-table .meta { color: var(--text-secondary); font-size: 12px; white-space: nowrap; }
    .file-table .actions { text-align: right; white-space: nowrap; }
    .row-actions { display: inline-flex; gap: 6px; }
    .icon-btn {
      padding: 6px 10px; font-size: 12px; border-radius: 8px; border: none; cursor: pointer;
      background: rgba(255,255,255,0.08); color: var(--text-secondary); transition: all 0.15s ease;
    }
    .icon-btn:hover { background: rgba(255,255,255,0.16); color: var(--text-primary); }
    .icon-btn.danger { background: rgba(239,68,68,0.14); color: #fca5a5; }
    .icon-btn.danger:hover { background: rgba(239,68,68,0.24); }

    .empty-state { text-align: center; padding: 44px 16px; color: var(--text-secondary); }
    .empty-state .icon { font-size: 44px; margin-bottom: 12px; opacity: 0.5; }

    /* 登录/设置弹窗（毛玻璃：透出并模糊后方页面） */
    .login-modal {
      position: fixed; inset: 0; background: rgba(10,10,15,0.45);
      backdrop-filter: blur(18px) saturate(1.2);
      -webkit-backdrop-filter: blur(18px) saturate(1.2);
      display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 24px;
    }
    .login-box {
      background: rgba(30, 30, 45, 0.55);
      backdrop-filter: blur(28px) saturate(1.3);
      -webkit-backdrop-filter: blur(28px) saturate(1.3);
      border: 1px solid rgba(255, 255, 255, 0.14);
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.08);
      border-radius: 20px; padding: 36px; width: 100%; max-width: 400px; text-align: center;
    }
    .login-box h2 { margin-bottom: 6px; font-size: 1.4rem; }
    .login-box p { color: var(--text-secondary); font-size: 13px; margin-bottom: 22px; }
    .login-box input {
      width: 100%; padding: 12px 16px; margin-bottom: 14px; font-size: 15px;
      background: rgba(0,0,0,0.4); border: 1px solid var(--border-color);
      border-radius: 12px; color: var(--text-primary);
    }
    .login-box input:focus { outline: none; border-color: var(--accent-purple); }
    .login-box .btn { width: 100%; justify-content: center; padding: 13px; background: linear-gradient(135deg, var(--accent-purple), var(--accent-cyan)); }

    /* Toast */
    .toast {
      position: fixed; top: 24px; right: 24px; padding: 14px 22px; border-radius: 12px;
      color: #fff; font-weight: 500; z-index: 2300; font-size: 14px; max-width: 380px;
      backdrop-filter: blur(20px); animation: slideIn 0.3s ease;
    }
    .toast.success { background: rgba(16,185,129,0.9); }
    .toast.error { background: rgba(239,68,68,0.9); }
    .toast.info { background: rgba(59,130,246,0.9); }
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

    /* 确认弹窗 */
    .confirm-modal {
      position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(10px);
      display: flex; align-items: center; justify-content: center; z-index: 2200; padding: 24px;
    }
    .confirm-box {
      background: linear-gradient(180deg, rgba(30,30,45,0.97), rgba(18,18,26,0.98));
      border: 1px solid rgba(239,68,68,0.2); border-radius: 20px; padding: 26px;
      width: 100%; max-width: 400px;
    }
    .confirm-box h3 { margin-bottom: 10px; font-size: 1.15rem; }
    .confirm-box p { color: var(--text-secondary); font-size: 14px; margin-bottom: 20px; word-break: break-all; }
    .confirm-box .actions { display: flex; justify-content: flex-end; gap: 10px; }
    .confirm-box .btn-cancel {
      padding: 10px 16px; border-radius: 10px; border: none; cursor: pointer; font-size: 14px;
      background: rgba(255,255,255,0.08); color: var(--text-primary);
    }
    .confirm-box .btn-ok {
      padding: 10px 16px; border-radius: 10px; border: none; cursor: pointer; font-size: 14px; font-weight: 600;
      background: linear-gradient(135deg, rgba(239,68,68,0.95), rgba(220,38,38,0.95)); color: #fff;
    }

    @media (max-width: 640px) {
      body { padding: 14px; }
      .file-table th:nth-child(2), .file-table td:nth-child(2) { display: none; }
      .toolbar { gap: 8px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🗂 WebDAV 同步管理</h1>
      <p>查看与管理 WebDAV 同步到 R2 的配置文件（存储前缀 dav/）</p>
      <a class="back-link" href="/">📁 文件中转站</a>
    </div>

    <div class="card" id="browserCard" style="display:none">
      <div class="toolbar">
        <button class="btn btn-mkdir" id="mkdirBtn">📁 新建文件夹</button>
        <button class="btn btn-upload" id="uploadBtn">⬆ 上传文件</button>
        <button class="btn btn-refresh" id="refreshBtn">🔄 刷新</button>
        <input type="text" id="pathInput" placeholder="/路径/文件夹（回车跳转）">
        <input type="file" id="uploadInput" multiple style="display:none">
      </div>

      <div class="breadcrumb" id="breadcrumb"></div>

      <table class="file-table">
        <thead>
          <tr><th>名称</th><th style="width:120px">大小</th><th style="width:170px">修改时间</th><th></th></tr>
        </thead>
        <tbody id="fileRows"></tbody>
      </table>
      <div class="empty-state" id="emptyState" style="display:none">
        <div class="icon">📂</div>
        <div>此目录为空</div>
      </div>
    </div>

    <div id="settingsModal" class="login-modal" style="display:none">
      <div class="login-box" style="text-align:left">
        <div style="font-size:48px;margin-bottom:12px;text-align:center">⚙️</div>
        <h2 style="text-align:center;margin-bottom:20px">设置</h2>
        <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px">账号</label>
        <input type="text" id="setAuthUser" placeholder="登录账号" style="margin-bottom:14px">
        <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px">新密码（留空则不修改）</label>
        <input type="password" id="setNewPassword" placeholder="新密码" autocomplete="new-password" style="margin-bottom:14px">
        <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px">网站背景（https 图片地址或 WebDAV 图片路径，留空恢复默认）</label>
        <input type="text" id="setBgUrl" placeholder="https://... 或 /dav/xxx.jpg" style="margin-bottom:18px">
        <button class="btn" id="settingsSaveBtn" style="width:100%;justify-content:center;background:linear-gradient(135deg,var(--accent-purple),var(--accent-cyan));margin-bottom:10px">保存设置</button>
        <button class="btn" id="settingsCloseBtn" style="width:100%;justify-content:center;background:rgba(255,255,255,0.1)">关闭</button>
      </div>
    </div>

    <div id="confirmModal" class="confirm-modal" style="display:none">
      <div class="confirm-box">
        <h3 id="confirmTitle">确认删除</h3>
        <p id="confirmDesc"></p>
        <div class="actions">
          <button class="btn-cancel" id="confirmCancel">取消</button>
          <button class="btn-ok" id="confirmOk">删除</button>
        </div>
      </div>
    </div>

    <button id="settingsBtn" title="设置" style="position:fixed;top:16px;right:72px;z-index:1500;width:42px;height:42px;border-radius:12px;border:1px solid var(--border-color);background:rgba(30,30,45,0.7);backdrop-filter:blur(10px);color:var(--text-primary);font-size:19px;cursor:pointer;transition:all 0.2s ease;">⚙</button>
    <button id="logoutBtn" title="退出登录" style="position:fixed;top:16px;right:16px;z-index:1500;width:42px;height:42px;border-radius:12px;border:1px solid var(--border-color);background:rgba(30,30,45,0.7);backdrop-filter:blur(10px);color:var(--text-primary);cursor:pointer;transition:all 0.2s ease;display:flex;align-items:center;justify-content:center;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
    </button>
  </div>

  <script>
    var WEBDAV_BASE = '/dav';
    // 全局认证：浏览器端凭服务端签发的会话 Cookie，无需 Basic Auth 头
    var currentPath = '/';
    var items = [];

    function authHeader() {
      return {};
    }

    function showToast(msg, type) {
      var t = document.createElement('div');
      t.className = 'toast ' + (type || 'info');
      t.textContent = msg;
      document.body.appendChild(t);
      setTimeout(function(){ t.remove(); }, 3000);
    }

    function formatSize(b) {
      if (!b) return '-';
      var k = 1024, sizes = ['B','KB','MB','GB'];
      var i = Math.floor(Math.log(b) / Math.log(k));
      return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function formatTime(d) {
      if (!d || isNaN(d)) return '-';
      return d.toLocaleString('zh-CN');
    }

    function escapeHtml(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function(m) {
        return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m];
      });
    }

    function joinPath(dir, name) {
      return dir.replace(/\\/+$/, '') + '/' + name;
    }

    /* ---- PROPFIND 解析（轻量正则解析 multistatus XML） ---- */
    function parseMultistatus(xmlText) {
      var results = [];
      var responses = xmlText.split(/<D:response[\\s>]/i).slice(1);
      for (var i = 0; i < responses.length; i++) {
        var seg = responses[i].split('</D:response>')[0];
        var hrefMatch = seg.match(/<D:href>([\\s\\S]*?)<\\/D:href>/i);
        if (!hrefMatch) continue;
        var href = hrefMatch[1];
        var isDir = /<D:collection\\s*\\/>/i.test(seg) || /<D:collection>/i.test(seg);
        var lenMatch = seg.match(/<D:getcontentlength>(\\d+)<\\/D:getcontentlength>/i);
        var size = lenMatch ? parseInt(lenMatch[1], 10) : 0;
        var modMatch = seg.match(/<D:getlastmodified>([\\s\\S]*?)<\\/D:getlastmodified>/i);
        var mtime = modMatch ? new Date(modMatch[1]) : null;
        var name = decodeURIComponent(href.replace(/\\/+$/, '').split('/').pop() || '');
        // 自身项过滤：服务端返回的自身 href 可能带或不带尾斜杠，统一归一化后比较
        var selfHref = WEBDAV_BASE + (currentPath === '/' ? '/' : currentPath);
        if (href.replace(/\\/+$/, '') === selfHref.replace(/\\/+$/, '')) continue;
        if (!name) continue;
        results.push({ name: name, isDir: isDir, size: size, mtime: mtime, href: href });
      }
      results.sort(function(a, b) {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      return results;
    }

    async function listDir(path) {
      var res = await fetch(WEBDAV_BASE + path, {
        method: 'PROPFIND',
        headers: Object.assign(authHeader(), { 'Depth': '1' })
      });
      if (res.status === 401) { redirectToLogin(); throw new Error('未授权'); }
      if (!res.ok) throw new Error('PROPFIND ' + res.status);
      var text = await res.text();
      return parseMultistatus(text);
    }

    var renderSeq = 0; // 渲染序号：防止并发 render 互相叠加（快速刷新/跳转时）

    async function render() {
      var seq = ++renderSeq;
      var rows = document.getElementById('fileRows');
      var empty = document.getElementById('emptyState');
      rows.innerHTML = '';
      try {
        var listed = await listDir(currentPath);
        if (seq !== renderSeq) return; // 已有更新的渲染发起，丢弃本次过期结果
        items = listed;
      } catch (err) {
        if (seq !== renderSeq) return;
        if (err.message !== '未授权') showToast('读取目录失败: ' + err.message, 'error');
        return;
      }

      renderBreadcrumb();
      document.getElementById('pathInput').value = currentPath;

      if (items.length === 0) {
        empty.style.display = 'block';
        return;
      }
      empty.style.display = 'none';

      for (var i = 0; i < items.length; i++) {
        (function(item) {
          var tr = document.createElement('tr');
          tr.className = 'row';
          var displayName = item.isDir ? '📁 ' + escapeHtml(item.name) : '📄 ' + escapeHtml(item.name);
          var actions = '';
          if (!item.isDir) {
            actions = '<div class="row-actions">' +
              '<button class="icon-btn" data-act="copy">🔗 链接</button>' +
              '<button class="icon-btn" data-act="download">⬇ 下载</button>' +
              '<button class="icon-btn danger" data-act="delete">🗑</button>' +
            '</div>';
          } else {
            actions = '<div class="row-actions">' +
              '<button class="icon-btn danger" data-act="delete">🗑</button>' +
            '</div>';
          }
          tr.innerHTML =
            '<td class="name">' + displayName + '</td>' +
            '<td class="meta">' + (item.isDir ? '目录' : formatSize(item.size)) + '</td>' +
            '<td class="meta">' + formatTime(item.mtime) + '</td>' +
            '<td class="actions">' + actions + '</td>';

          tr.addEventListener('click', function(e) {
            if (e.target.closest('.row-actions')) return;
            if (item.isDir) {
              currentPath = joinPath(currentPath, item.name) + '/';
              render();
            }
          });
          tr.querySelectorAll('.icon-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
              e.stopPropagation();
              var act = btn.dataset.act;
              if (act === 'delete') confirmDelete(item);
              else if (act === 'download') window.open(WEBDAV_BASE + joinPath(currentPath, encodeURIComponent(item.name)), '_blank');
              else if (act === 'copy') copyLink(item);
            });
          });
          rows.appendChild(tr);
        })(items[i]);
      }
    }

    function renderBreadcrumb() {
      var bc = document.getElementById('breadcrumb');
      bc.innerHTML = '';
      var rootLink = document.createElement('a');
      rootLink.textContent = '🏠 根目录';
      rootLink.href = '#';
      rootLink.addEventListener('click', function(e) { e.preventDefault(); currentPath = '/'; render(); });
      bc.appendChild(rootLink);

      var parts = currentPath.split('/').filter(Boolean);
      var acc = '/';
      for (var i = 0; i < parts.length; i++) {
        acc = acc + parts[i] + '/';
        var sep = document.createElement('span');
        sep.className = 'sep'; sep.textContent = '›';
        bc.appendChild(sep);
        var link = document.createElement('a');
        link.textContent = decodeURIComponent(parts[i]);
        link.href = '#';
        (function(p) {
          link.addEventListener('click', function(e) { e.preventDefault(); currentPath = p; render(); });
        })(acc);
        bc.appendChild(link);
      }
      var cur = document.createElement('span');
      cur.className = 'current'; cur.textContent = decodeURIComponent(parts[parts.length - 1] || '');
      // 最后一项用高亮文本（上面已作为 link 加入，这里不重复加）
    }

    function confirmDelete(item) {
      var modal = document.getElementById('confirmModal');
      document.getElementById('confirmDesc').textContent =
        '确认删除 "' + item.name + (item.isDir ? '/（整个目录）' : '') + '" 吗？该操作无法恢复。';
      modal.style.display = 'flex';
      var ok = document.getElementById('confirmOk');
      var cancel = document.getElementById('confirmCancel');
      ok.onclick = async function() {
        modal.style.display = 'none';
        try {
          var target = WEBDAV_BASE + joinPath(currentPath, encodeURIComponent(item.name)) + (item.isDir ? '/' : '');
          var res = await fetch(target, { method: 'DELETE', headers: authHeader() });
          if (res.ok || res.status === 204 || res.status === 404) {
            showToast('已删除: ' + item.name, 'success');
          } else {
            throw new Error('HTTP ' + res.status);
          }
        } catch (err) {
          showToast('删除失败: ' + err.message, 'error');
        }
        render();
      };
      cancel.onclick = function() { modal.style.display = 'none'; };
    }

    async function copyLink(item) {
      var url = location.origin + WEBDAV_BASE + joinPath(currentPath, encodeURIComponent(item.name));
      try {
        await navigator.clipboard.writeText(url);
        showToast('链接已复制', 'success');
      } catch (e) {
        showToast('复制失败: ' + url, 'error');
      }
    }

    function redirectToLogin() {
      location.href = '/';
    }

    function showBrowser() {
      document.getElementById('browserCard').style.display = 'block';
      render();
    }

    /* ---- 事件绑定 ---- */
    document.getElementById('logoutBtn').addEventListener('click', async function() {
      try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (e) {}
      redirectToLogin();
    });

    function setupSettingsModal() {
      var modal = document.getElementById('settingsModal');
      var btn = document.getElementById('settingsBtn');
      if (!modal || !btn || modal.dataset.bound === '1') return;

      btn.addEventListener('click', async function() {
        try {
          var res = await fetch('/api/settings');
          var data = await res.json();
          document.getElementById('setAuthUser').value = data.authUser || '';
          document.getElementById('setNewPassword').value = '';
          document.getElementById('setBgUrl').value = data.bgUrl || '';
        } catch (e) {}
        modal.style.display = 'flex';
      });

      document.getElementById('settingsCloseBtn').addEventListener('click', function() {
        modal.style.display = 'none';
      });

      document.getElementById('settingsSaveBtn').addEventListener('click', async function() {
        var saveBtn = this;
        var userVal = document.getElementById('setAuthUser').value.trim();
        var passVal = document.getElementById('setNewPassword').value;
        var bgVal = document.getElementById('setBgUrl').value.trim();
        if (!userVal) { showToast('账号不能为空', 'error'); return; }
        if (passVal && passVal.length < 4) { showToast('密码至少 4 位', 'error'); return; }
        saveBtn.disabled = true; saveBtn.textContent = '保存中...';
        try {
          var res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ authUser: userVal, newPassword: passVal || undefined, bgUrl: bgVal })
          });
          var data = await res.json();
          if (!res.ok || data.error) throw new Error(data.error || '保存失败');
          showToast('设置已保存', 'success');
          applySiteBackground(data.bgUrl || '');
          modal.style.display = 'none';
        } catch (err) {
          showToast('保存失败: ' + err.message, 'error');
        } finally {
          saveBtn.disabled = false; saveBtn.textContent = '保存设置';
        }
      });

      modal.dataset.bound = '1';
    }

    function applySiteBackground(bgUrl) {
      var url = (bgUrl || '').trim();
      if (!url) return;
      var safeUrl = url.replace(/[^a-zA-Z0-9:/._~?&=%-]/g, '');
      document.body.style.backgroundImage =
        'linear-gradient(rgba(10,10,15,0.82), rgba(10,10,15,0.82)), url("' + safeUrl + '")';
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundAttachment = 'fixed';
    }

    async function loadSiteBackground() {
      try {
        var res = await fetch('/api/settings');
        var data = await res.json();
        applySiteBackground(data.bgUrl || '');
      } catch (e) {}
    }

    document.getElementById('refreshBtn').addEventListener('click', render);

    document.getElementById('pathInput').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        var p = this.value.trim();
        if (!p) return;
        if (!p.startsWith('/')) p = '/' + p;
        if (!p.endsWith('/')) p += '/';
        currentPath = p;
        render();
      }
    });

    document.getElementById('mkdirBtn').addEventListener('click', async function() {
      var name = prompt('输入新文件夹名称：');
      if (!name) return;
      name = encodeURIComponent(name.trim());
      if (!name) return;
      try {
        var res = await fetch(WEBDAV_BASE + joinPath(currentPath, name) + '/', {
          method: 'MKCOL', headers: authHeader()
        });
        if (res.status === 201) showToast('文件夹已创建', 'success');
        else throw new Error('HTTP ' + res.status);
      } catch (err) {
        showToast('创建失败: ' + err.message, 'error');
      }
      render();
    });

    document.getElementById('uploadBtn').addEventListener('click', function() {
      document.getElementById('uploadInput').click();
    });
    document.getElementById('uploadInput').addEventListener('change', async function(e) {
      var files = Array.from(e.target.files || []);
      this.value = '';
      if (!files.length) return;
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        showToast('上传中: ' + f.name, 'info');
        try {
          var res = await fetch(WEBDAV_BASE + joinPath(currentPath, encodeURIComponent(f.name)), {
            method: 'PUT',
            headers: Object.assign(authHeader(), { 'Content-Type': f.type || 'application/octet-stream' }),
            body: f
          });
          if (!res.ok) throw new Error('HTTP ' + res.status);
        } catch (err) {
          showToast('上传失败: ' + f.name + ' (' + err.message + ')', 'error');
        }
      }
      showToast('上传完成', 'success');
      render();
    });

    /* ---- 初始化 ---- */
    (function init() {
      setupSettingsModal();
      // 能进入本页说明服务端已校验会话（未登录会被 302 到主页）
      showBrowser();
      loadSiteBackground();
    })();
  </script>
</body>
</html>`;
}

// ==================== 主处理函数 ====================

export default {
  // 仅供本地预览/测试工具读取页面模板（生产环境不使用）
  __WEBDAV_UI_HTML__: getWebDavUiHtml(),
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    const bucket = env[CONFIG.BUCKET_NAME];
    if (!bucket) {
      return new Response('R2 Bucket not configured. Please bind bucket named: ' + CONFIG.BUCKET_NAME, { status: 500 });
    }

    const baseUrl = CONFIG.CUSTOM_DOMAIN || url.origin;

    try {
      // 处理 /d/:fileId/verify 验证端点（必须在 handleDownload 之前）
      if (path.match(/^\/d\/[^\/]+\/verify$/) && request.method === 'POST') {
        return handleVerifyPassword(request, env, bucket, path);
      }

      if (path.startsWith('/api/v1/')) {
        return handleApiV1(request, env, bucket, baseUrl, path);
      }

      // 认证 API（登录/登出/设置读取）
      if (path === '/api/auth/login' && request.method === 'POST') {
        return handleAuthLogin(request, bucket);
      }
      if (path === '/api/auth/logout' && request.method === 'POST') {
        return handleAuthLogout();
      }
      if (path === '/api/auth/status' && request.method === 'GET') {
        const loggedIn = await isSessionValid(request, env);
        const cfg = await getSiteConfig(bucket);
        return jsonResponse({ loggedIn, authEnabled: true, authUser: cfg.authUser, bgUrl: cfg.bgUrl });
      }

      // 设置 API（读取无需登录，保存需要登录）
      if (path === '/api/settings' && request.method === 'GET') {
        return handleGetSettings(bucket);
      }
      if (path === '/api/settings' && request.method === 'POST') {
        if (!(await isSessionValid(request, env))) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        return handleSaveSettings(request, bucket);
      }

      if (path.startsWith('/api/')) {
        return handleApi(request, env, bucket, baseUrl, path);
      }

      // WebDAV 管理界面（独立页面）：未登录重定向主页，登录后才能进入
      if (CONFIG.WEBDAV_ENABLED && path === (CONFIG.WEBDAV_PATH + '-ui')) {
        if (!(await isSessionValid(request, env))) {
          return new Response(null, { status: 302, headers: { 'Location': '/' } });
        }
        return new Response(getWebDavUiHtml(), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      // WebDAV 接口（配置同步）：会话 Cookie 或 Basic Auth 任一通过即可
      if (CONFIG.WEBDAV_ENABLED && (path === CONFIG.WEBDAV_PATH || path.startsWith(CONFIG.WEBDAV_PATH + '/'))) {
        const sessionOk = await isSessionValid(request, env);
        if (!sessionOk) {
          const basicAuthError = await checkWebDavBasicAuth(request, bucket);
          if (basicAuthError) return basicAuthError;
        }
        return handleWebDav(request, env, bucket, path);
      }

      if (path.startsWith('/d/')) {
        const fileId = path.slice(3).split('?')[0];
        return handleDownload(request, env, bucket, fileId, baseUrl);
      }

      // 主页面：启用认证时未登录显示登录页（由前端渲染，避免闪烁）
      const loggedIn = await isSessionValid(request, env);
      return new Response(getIndexHtml(loggedIn), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });

    } catch (err) {
      console.error('Error:', err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

// ==================== API 处理 ====================

async function handleApi(request, env, bucket, baseUrl, path) {
  // POST /api/verify - 验证全局密码
  if (path === '/api/verify' && request.method === 'POST') {
    const { password } = await request.json();
    return jsonResponse({
      success: password === CONFIG.ACCESS_PASSWORD
    });
  }

  // POST /api/upload-url - 获取上传 URL（支持分享密码）
  if (path === '/api/upload-url' && request.method === 'POST') {
    const { filename, size, type, password } = await request.json();

    if (size > CONFIG.MAX_FILE_SIZE) {
      return jsonResponse({ error: 'File too large' }, 400);
    }

    if (CONFIG.ALLOWED_TYPES.length > 0 && !CONFIG.ALLOWED_TYPES.includes(type)) {
      return jsonResponse({ error: 'File type not allowed' }, 400);
    }

    const storage = await collectStorageState(bucket, baseUrl, {
      includeFiles: false,
      countPending: true
    });
    if (storage.remainingBytes <= 0) {
      return jsonResponse({
        error: '存储空间已满，无法继续上传',
        remainingBytes: storage.remainingBytes,
        limitBytes: storage.limitBytes
      }, 400);
    }

    if (size > storage.remainingBytes) {
      return jsonResponse({
        error: '剩余存储空间不足，无法上传该文件',
        remainingBytes: storage.remainingBytes,
        limitBytes: storage.limitBytes
      }, 400);
    }

    const fileId = generateId();
    const safeName = sanitizeFilename(filename);

    // 处理分享密码哈希
    let passwordHash = null;
    let passwordSalt = null;
    if (password && password.trim() !== '') {
      passwordSalt = generateSalt();
      passwordHash = await hashPassword(password.trim(), passwordSalt);
    }

    const uploadTime = Date.now();
    const expireTime = CONFIG.FILE_EXPIRE_TIME ? uploadTime + CONFIG.FILE_EXPIRE_TIME : 0;

    // 存储元数据
    await bucket.put('_meta/' + fileId, JSON.stringify({
      filename: safeName,
      size,
      type: type || 'application/octet-stream',
      uploadTime: uploadTime,
      expireTime: expireTime,
      passwordHash: passwordHash,
      passwordSalt: passwordSalt,
      uploaded: false
    }));

    // 判断是否需要分片上传
    const useMultipart = size > CONFIG.MULTIPART_THRESHOLD;

    return jsonResponse({
      uploadUrl: baseUrl + '/api/upload/' + fileId,
      fileId: fileId,
      downloadUrl: baseUrl + '/d/' + fileId,
      hasPassword: !!passwordHash,
      uploadTime: uploadTime,
      expireTime: expireTime,
      remainingBytes: Math.max(0, storage.remainingBytes - size),
      useMultipart: useMultipart,
      chunkSize: CONFIG.CHUNK_SIZE
    });
  }

  // PUT /api/upload/:fileId - 实际上传文件（小文件直接上传）
  if (path.startsWith('/api/upload/') && request.method === 'PUT') {
    const fileId = path.split('/').pop();
    const metaKey = '_meta/' + fileId;

    const meta = await bucket.get(metaKey);
    if (!meta) {
      return new Response('Upload session not found', { status: 404 });
    }

    const metaData = JSON.parse(await meta.text());
    const key = 'uploads/' + fileId + '/' + metaData.filename;

    const body = request.body;
    if (!body) {
      return new Response('No file data', { status: 400 });
    }

    await bucket.put(key, body, {
      httpMetadata: {
        contentType: metaData.type,
      },
      customMetadata: {
        fileid: fileId,
        originalname: metaData.filename,
      }
    });

    await bucket.put(metaKey, JSON.stringify({
      ...metaData,
      key: key,
      uploaded: true
    }));

    return new Response('OK', { status: 200 });
  }

  // POST /api/multipart/create - 初始化分片上传
  if (path === '/api/multipart/create' && request.method === 'POST') {
    const { fileId, totalChunks } = await request.json();
    const metaKey = '_meta/' + fileId;

    const meta = await bucket.get(metaKey);
    if (!meta) {
      return jsonResponse({ error: 'Upload session not found' }, 404);
    }

    const metaData = JSON.parse(await meta.text());
    const key = 'uploads/' + fileId + '/' + metaData.filename;

    // 初始化分片上传状态
    await bucket.put('_multipart/' + fileId, JSON.stringify({
      fileId: fileId,
      key: key,
      totalChunks: totalChunks,
      uploadedChunks: [],
      createdAt: Date.now()
    }));

    return jsonResponse({
      success: true,
      fileId: fileId,
      totalChunks: totalChunks
    });
  }

  // POST /api/multipart/upload - 上传单个分片
  if (path === '/api/multipart/upload' && request.method === 'POST') {
    const urlObj = new URL(request.url);
    const fileId = urlObj.searchParams.get('fileId');
    const chunkIndex = parseInt(urlObj.searchParams.get('chunkIndex'));

    if (!fileId || isNaN(chunkIndex)) {
      return jsonResponse({ error: 'Missing fileId or chunkIndex' }, 400);
    }

    const multipartKey = '_multipart/' + fileId;
    const multipart = await bucket.get(multipartKey);
    if (!multipart) {
      return jsonResponse({ error: 'Multipart upload not found' }, 404);
    }

    const multipartData = JSON.parse(await multipart.text());
    const body = request.body;
    if (!body) {
      return new Response('No chunk data', { status: 400 });
    }

    // 存储分片
    const chunkKey = multipartData.key + '.part.' + chunkIndex;
    await bucket.put(chunkKey, body);

    // 更新已上传分片列表
    if (!multipartData.uploadedChunks.includes(chunkIndex)) {
      multipartData.uploadedChunks.push(chunkIndex);
    }
    await bucket.put(multipartKey, JSON.stringify(multipartData));

    return jsonResponse({
      success: true,
      chunkIndex: chunkIndex,
      uploadedChunks: multipartData.uploadedChunks.length,
      totalChunks: multipartData.totalChunks
    });
  }

  // POST /api/multipart/complete - 完成分片上传（合并所有分片）
  if (path === '/api/multipart/complete' && request.method === 'POST') {
    const { fileId } = await request.json();
    const metaKey = '_meta/' + fileId;
    const multipartKey = '_multipart/' + fileId;

    const meta = await bucket.get(metaKey);
    const multipart = await bucket.get(multipartKey);

    if (!meta || !multipart) {
      return jsonResponse({ error: 'Upload session not found' }, 404);
    }

    const metaData = JSON.parse(await meta.text());
    const multipartData = JSON.parse(await multipart.text());
    const key = multipartData.key;

    // 检查所有分片是否都已上传
    for (let i = 0; i < multipartData.totalChunks; i++) {
      const chunkKey = key + '.part.' + i;
      const chunk = await bucket.get(chunkKey);
      if (!chunk) {
        return jsonResponse({ error: 'Missing chunk ' + i }, 400);
      }
    }

    // 使用 R2 的 multipart upload 功能来合并分片
    // 由于 Workers 内存限制，我们创建一个特殊的元数据标记这个文件是分片的
    // 下载时会按顺序读取所有分片
    await bucket.put(metaKey, JSON.stringify({
      ...metaData,
      key: key,
      uploaded: true,
      isMultipart: true,
      totalChunks: multipartData.totalChunks
    }));

    // 删除分片上传记录（保留分片文件，用于下载时读取）
    await bucket.delete(multipartKey);

    return jsonResponse({
      success: true,
      fileId: fileId,
      downloadUrl: baseUrl + '/d/' + fileId
    });
  }

  // POST /api/multipart/abort - 取消分片上传
  if (path === '/api/multipart/abort' && request.method === 'POST') {
    const { fileId } = await request.json();
    const metaKey = '_meta/' + fileId;
    const multipartKey = '_multipart/' + fileId;

    const multipart = await bucket.get(multipartKey);
    if (multipart) {
      const multipartData = JSON.parse(await multipart.text());
      const key = multipartData.key;

      // 删除已上传的分片
      for (let i = 0; i < multipartData.totalChunks; i++) {
        try {
          await bucket.delete(key + '.part.' + i);
        } catch (e) {
          // 忽略删除失败
        }
      }
      await bucket.delete(multipartKey);
    }

    // 删除元数据
    try {
      await bucket.delete(metaKey);
    } catch (e) {
      // 忽略删除失败
    }

    return jsonResponse({ success: true });
  }

  // POST /api/file/delete - 删除文件（包括分片文件）
  if (path === '/api/file/delete' && request.method === 'POST') {
    const { fileId } = await request.json();
    const metaKey = '_meta/' + fileId;

    const meta = await bucket.get(metaKey);
    if (!meta) {
      return jsonResponse({ error: 'File not found' }, 404);
    }

    const metaData = JSON.parse(await meta.text());
    await deleteFileWithChunks(bucket, metaData, metaKey);

    return jsonResponse({ success: true });
  }

  // GET /api/files - 读取已上传文件记录
  if (path === '/api/files' && request.method === 'GET') {
    const storage = await collectStorageState(bucket, baseUrl, { includeFiles: true });
    storage.files.sort((a, b) => (b.uploadTime || 0) - (a.uploadTime || 0));
    return jsonResponse({
      files: storage.files,
      storage: {
        limitBytes: storage.limitBytes,
        usedBytes: storage.usedBytes,
        remainingBytes: storage.remainingBytes
      }
    });
  }

  // GET /api/storage - 读取存储空间状态
  if (path === '/api/storage' && request.method === 'GET') {
    const storage = await collectStorageState(bucket, baseUrl, { includeFiles: false });
    return jsonResponse({
      limitBytes: storage.limitBytes,
      usedBytes: storage.usedBytes,
      remainingBytes: storage.remainingBytes
    });
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

// ==================== API v1（程序化接口） ====================

// API Key 认证检查
function checkApiKey(request) {
  if (!CONFIG.API_KEY) {
    return jsonResponse({ error: 'API Key not configured on server. Set API_KEY in CONFIG.' }, 503);
  }
  const provided = request.headers.get('X-API-Key') || '';
  if (provided !== CONFIG.API_KEY) {
    return jsonResponse({ error: 'Unauthorized: invalid or missing X-API-Key header' }, 401);
  }
  return null; // 认证通过
}

async function handleApiV1(request, env, bucket, baseUrl, path) {
  // 所有 /api/v1/* 接口都需要 API Key 认证
  const authError = checkApiKey(request);
  if (authError) return authError;

  const subPath = path.replace('/api/v1', '');

  // GET /api/v1/files - 列出所有文件
  if (subPath === '/files' && request.method === 'GET') {
    const storage = await collectStorageState(bucket, baseUrl, { includeFiles: true });
    storage.files.sort((a, b) => (b.uploadTime || 0) - (a.uploadTime || 0));
    return jsonResponse({
      files: storage.files,
      storage: {
        limitBytes: storage.limitBytes,
        usedBytes: storage.usedBytes,
        remainingBytes: storage.remainingBytes
      }
    });
  }

  // GET /api/v1/storage - 查看存储空间
  if (subPath === '/storage' && request.method === 'GET') {
    const storage = await collectStorageState(bucket, baseUrl, { includeFiles: false });
    return jsonResponse({
      limitBytes: storage.limitBytes,
      usedBytes: storage.usedBytes,
      remainingBytes: storage.remainingBytes
    });
  }

  // PUT /api/v1/upload - 直接上传文件内容
  // Headers: X-Filename (required), Content-Type (optional), X-Expire-Ms (optional), X-Share-Password (optional)
  // Body: raw file content
  if (subPath === '/upload' && request.method === 'PUT') {
    return handleApiV1Upload(request, bucket, baseUrl);
  }

  // POST /api/v1/upload-url - 从 URL 下载文件并存储
  // Body JSON: { url, filename?, expireMs?, sharePassword? }
  if (subPath === '/upload-url' && request.method === 'POST') {
    return handleApiV1UploadUrl(request, env, bucket, baseUrl);
  }

  // GET /api/v1/download/:fileId - 直接下载文件内容（返回二进制流）
  if (subPath.startsWith('/download/') && request.method === 'GET') {
    const fileId = subPath.split('/')[2];
    return handleApiV1Download(fileId, bucket);
  }

  // POST /api/v1/delete - 删除文件
  // Body JSON: { fileId }
  if (subPath === '/delete' && request.method === 'POST') {
    const { fileId } = await request.json();
    if (!fileId) return jsonResponse({ error: 'fileId is required' }, 400);

    const metaKey = '_meta/' + fileId;
    const meta = await bucket.get(metaKey);
    if (!meta) return jsonResponse({ error: 'File not found' }, 404);

    const metaData = JSON.parse(await meta.text());
    await deleteFileWithChunks(bucket, metaData, metaKey);
    return jsonResponse({ success: true, fileId });
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

// PUT /api/v1/upload 实现
async function handleApiV1Upload(request, bucket, baseUrl) {
  const filename = request.headers.get('X-Filename');
  if (!filename) {
    return jsonResponse({ error: 'X-Filename header is required' }, 400);
  }

  const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
  const size = parseInt(request.headers.get('Content-Length') || '0', 10);
  const expireMs = parseInt(request.headers.get('X-Expire-Ms') || '0', 10) || CONFIG.FILE_EXPIRE_TIME;
  const sharePassword = request.headers.get('X-Share-Password') || '';

  if (size > CONFIG.MAX_FILE_SIZE) {
    return jsonResponse({ error: 'File too large', maxSize: CONFIG.MAX_FILE_SIZE }, 400);
  }

  // 存储空间检查
  const storage = await collectStorageState(bucket, baseUrl, { includeFiles: false, countPending: true });
  if (storage.remainingBytes <= 0) {
    return jsonResponse({ error: '存储空间已满' }, 400);
  }
  if (size > 0 && size > storage.remainingBytes) {
    return jsonResponse({ error: '剩余存储空间不足', remainingBytes: storage.remainingBytes }, 400);
  }

  const fileId = generateId();
  const safeName = sanitizeFilename(filename);
  const uploadTime = Date.now();
  const expireTime = expireMs ? uploadTime + expireMs : 0;

  let passwordHash = null;
  let passwordSalt = null;
  if (sharePassword && sharePassword.trim()) {
    passwordSalt = generateSalt();
    passwordHash = await hashPassword(sharePassword.trim(), passwordSalt);
  }

  const key = 'uploads/' + fileId + '/' + safeName;
  const body = request.body;
  if (!body) {
    return jsonResponse({ error: 'No file data in request body' }, 400);
  }

  await bucket.put(key, body, {
    httpMetadata: { contentType },
    customMetadata: { fileid: fileId, originalname: safeName }
  });

  await bucket.put('_meta/' + fileId, JSON.stringify({
    filename: safeName,
    size: size || 0,
    type: contentType,
    uploadTime,
    expireTime,
    passwordHash,
    passwordSalt,
    key,
    uploaded: true
  }));

  return jsonResponse({
    success: true,
    fileId,
    filename: safeName,
    size: size || 0,
    downloadUrl: baseUrl + '/d/' + fileId,
    expireTime
  });
}

// POST /api/v1/upload-url 实现
async function handleApiV1UploadUrl(request, env, bucket, baseUrl) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { url: fileUrl, filename, expireMs, sharePassword } = body;
  if (!fileUrl) {
    return jsonResponse({ error: 'url is required' }, 400);
  }

  // 从 URL 下载文件
  let resp;
  try {
    resp = await fetch(fileUrl, {
      headers: { 'User-Agent': 'New-File-Transfer/1.0' }
    });
  } catch (e) {
    return jsonResponse({ error: 'Failed to fetch URL: ' + e.message }, 400);
  }

  if (!resp.ok) {
    return jsonResponse({ error: 'Failed to fetch URL: HTTP ' + resp.status }, 400);
  }

  const contentLength = parseInt(resp.headers.get('content-length') || '0', 10);
  const contentType = resp.headers.get('content-type') || 'application/octet-stream';

  // 从 URL 提取文件名（如果没有指定）
  let resolvedFilename = filename;
  if (!resolvedFilename) {
    try {
      const urlObj = new URL(fileUrl);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      resolvedFilename = pathParts.length > 0 ? decodeURIComponent(pathParts[pathParts.length - 1]) : 'download';
    } catch (e) {
      resolvedFilename = 'download';
    }
  }

  if (contentLength > CONFIG.MAX_FILE_SIZE) {
    return jsonResponse({ error: 'Remote file too large', maxSize: CONFIG.MAX_FILE_SIZE }, 400);
  }

  // 存储空间检查
  const storage = await collectStorageState(bucket, baseUrl, { includeFiles: false, countPending: true });
  if (storage.remainingBytes <= 0) {
    return jsonResponse({ error: '存储空间已满' }, 400);
  }
  if (contentLength > 0 && contentLength > storage.remainingBytes) {
    return jsonResponse({ error: '剩余存储空间不足', remainingBytes: storage.remainingBytes }, 400);
  }

  const fileId = generateId();
  const safeName = sanitizeFilename(resolvedFilename);
  const uploadTime = Date.now();
  const actualExpireMs = expireMs || CONFIG.FILE_EXPIRE_TIME;
  const expireTime = actualExpireMs ? uploadTime + actualExpireMs : 0;

  let passwordHash = null;
  let passwordSalt = null;
  if (sharePassword && sharePassword.trim()) {
    passwordSalt = generateSalt();
    passwordHash = await hashPassword(sharePassword.trim(), passwordSalt);
  }

  const key = 'uploads/' + fileId + '/' + safeName;

  if (!resp.body) {
    return jsonResponse({ error: 'No response body from URL' }, 400);
  }

  await bucket.put(key, resp.body, {
    httpMetadata: { contentType },
    customMetadata: { fileid: fileId, originalname: safeName, sourceUrl: fileUrl }
  });

  await bucket.put('_meta/' + fileId, JSON.stringify({
    filename: safeName,
    size: contentLength || 0,
    type: contentType,
    uploadTime,
    expireTime,
    passwordHash,
    passwordSalt,
    key,
    uploaded: true
  }));

  return jsonResponse({
    success: true,
    fileId,
    filename: safeName,
    size: contentLength || 0,
    downloadUrl: baseUrl + '/d/' + fileId,
    sourceUrl: fileUrl,
    expireTime
  });
}

// GET /api/v1/download/:fileId 实现
async function handleApiV1Download(fileId, bucket) {
  if (!fileId) {
    return jsonResponse({ error: 'fileId is required' }, 400);
  }

  const metaKey = '_meta/' + fileId;
  const meta = await bucket.get(metaKey);
  if (!meta) {
    return jsonResponse({ error: 'File not found' }, 404);
  }

  const metaData = JSON.parse(await meta.text());

  // 检查过期
  if (metaData.expireTime && metaData.expireTime < Date.now()) {
    await deleteFileWithChunks(bucket, metaData, metaKey);
    return jsonResponse({ error: 'File expired' }, 410);
  }

  if (!metaData.uploaded) {
    return jsonResponse({ error: 'File upload incomplete' }, 400);
  }

  return serveFile(bucket, metaData);
}

// ==================== 密码验证处理 ====================

async function handleVerifyPassword(request, env, bucket, path) {
  const fileId = path.split('/')[2];
  const { password } = await request.json();
  
  const metaKey = '_meta/' + fileId;
  const meta = await bucket.get(metaKey);
  if (!meta) {
    return jsonResponse({ error: 'File not found' }, 404);
  }
  
  const metaData = JSON.parse(await meta.text());
  
  // 检查文件是否过期
  if (metaData.expireTime && metaData.expireTime < Date.now()) {
    return jsonResponse({ error: 'File expired' }, 410);
  }
  
  // 如果没有设置密码，直接返回成功
  if (!metaData.passwordHash) {
    const expires = Date.now() + CONFIG.TEMP_LINK_EXPIRE;
    const token = await generateTempToken(fileId, expires, env);
    const downloadUrl = `${new URL(request.url).origin}/d/${fileId}?token=${token}&expires=${expires}`;
    return jsonResponse({ success: true, downloadUrl });
  }
  
  // 验证密码 - 使用相同的处理方式
  const inputPassword = password ? String(password).trim() : '';
  if (!inputPassword) {
    return jsonResponse({ success: false, error: '请输入密码' }, 403);
  }
  
  const computedHash = await hashPassword(inputPassword, metaData.passwordSalt);
  if (computedHash === metaData.passwordHash) {
    // 生成临时下载链接（5分钟有效）
    const expires = Date.now() + CONFIG.TEMP_LINK_EXPIRE;
    const token = await generateTempToken(fileId, expires, env);
    const downloadUrl = `${new URL(request.url).origin}/d/${fileId}?token=${token}&expires=${expires}`;
    return jsonResponse({ success: true, downloadUrl });
  } else {
    return jsonResponse({ success: false, error: '密码错误' }, 403);
  }
}

// ==================== 下载处理 ====================

// 删除文件（包括分片）
async function deleteFileWithChunks(bucket, metaData, metaKey) {
  // 如果是分片文件，删除所有分片
  if (metaData.isMultipart && metaData.totalChunks > 0) {
    for (let i = 0; i < metaData.totalChunks; i++) {
      try {
        await bucket.delete(metaData.key + '.part.' + i);
      } catch (e) {
        // 忽略删除失败
      }
    }
  } else if (metaData.key) {
    // 普通文件，直接删除
    try {
      await bucket.delete(metaData.key);
    } catch (e) {
      // 忽略删除失败
    }
  }

  // 删除元数据
  try {
    await bucket.delete(metaKey);
  } catch (e) {
    // 忽略删除失败
  }
}

async function collectStorageState(bucket, baseUrl, options = {}) {
  const limitBytes = CONFIG.STORAGE_LIMIT || (10 * 1024 * 1024 * 1024);
  const includeFiles = !!options.includeFiles;
  const countPending = !!options.countPending;
  const files = [];
  let usedBytes = 0;
  let cursor = undefined;

  do {
    const listed = await bucket.list({
      prefix: '_meta/',
      cursor: cursor
    });

    for (const obj of listed.objects) {
      const meta = await bucket.get(obj.key);
      if (!meta) continue;

      try {
        const metaData = JSON.parse(await meta.text());
        const fileId = obj.key.slice('_meta/'.length);

        if (metaData.expireTime && metaData.expireTime < Date.now()) {
          await deleteFileWithChunks(bucket, metaData, obj.key);
          continue;
        }

        const size = Number(metaData.size) || 0;
        if (metaData.uploaded) {
          usedBytes += size;
        } else if (countPending) {
          usedBytes += size;
          continue;
        } else {
          continue;
        }

        if (includeFiles) {
          files.push({
            fileId: fileId,
            filename: metaData.filename,
            size: size,
            type: metaData.type || 'application/octet-stream',
            uploadTime: metaData.uploadTime || 0,
            expireTime: metaData.expireTime || 0,
            hasPassword: !!metaData.passwordHash,
            downloadUrl: baseUrl + '/d/' + fileId
          });
        }
      } catch (e) {
        // 忽略异常元数据
      }
    }

    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  return {
    limitBytes: limitBytes,
    usedBytes: usedBytes,
    remainingBytes: Math.max(0, limitBytes - usedBytes),
    files: files
  };
}

// ==================== 站点配置与会话认证 ====================

// 站点配置在 R2 的存储 key
const SITE_CONFIG_KEY = '_config/site';
// 会话 Cookie 名称
const SESSION_COOKIE = 'dsh_session';
// 会话有效期：7 天
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

// 读取站点配置（合并 CONFIG 默认值），带内存缓存（Worker 生命周期内）
let _siteConfigCache = null;
let _siteConfigCacheAt = 0;
async function getSiteConfig(bucket) {
  // 缓存 30 秒，避免每次请求都读 R2
  if (_siteConfigCache && Date.now() - _siteConfigCacheAt < 30000) {
    return _siteConfigCache;
  }
  let stored = null;
  try {
    const obj = await bucket.get(SITE_CONFIG_KEY);
    if (obj) stored = JSON.parse(await obj.text());
  } catch (e) { /* 配置不存在或损坏则用默认 */ }
  const config = {
    // 认证：默认取 CONFIG.ACCESS_PASSWORD（兼容旧部署）
    authUser: (stored && stored.authUser) || CONFIG.WEBDAV_USERNAME || 'admin',
    authPassHash: (stored && stored.authPassHash) || null, // null = 未设置，回退 CONFIG.ACCESS_PASSWORD
    authPassSalt: (stored && stored.authPassSalt) || null,
    // WebDAV Basic Auth 密码哈希（与网页登录同一密码，单独存一份便于校验）
    // 背景：'' = 默认渐变
    bgUrl: (stored && stored.bgUrl) || '',
    updatedAt: (stored && stored.updatedAt) || 0,
  };
  _siteConfigCache = config;
  _siteConfigCacheAt = Date.now();
  return config;
}

function invalidateSiteConfigCache() {
  _siteConfigCache = null;
  _siteConfigCacheAt = 0;
}

// 保存站点配置
async function saveSiteConfig(bucket, patch) {
  const current = await getSiteConfig(bucket);
  const next = { ...current, ...patch, updatedAt: Date.now() };
  await bucket.put(SITE_CONFIG_KEY, JSON.stringify(next), {
    httpMetadata: { contentType: 'application/json' },
  });
  invalidateSiteConfigCache();
  return next;
}

// 校验登录密码：优先站点配置里的哈希，否则回退 CONFIG.ACCESS_PASSWORD
async function verifyAuthPassword(bucket, username, password) {
  const cfg = await getSiteConfig(bucket);
  const uOk = username === cfg.authUser;
  if (!uOk) return false;
  if (cfg.authPassHash && cfg.authPassSalt) {
    const computed = await hashPassword(String(password || ''), cfg.authPassSalt);
    return computed === cfg.authPassHash;
  }
  // 回退：与 CONFIG.ACCESS_PASSWORD 比对；若未设置全局密码，任何非空密码不通过
  if (!CONFIG.ACCESS_PASSWORD) return false;
  return String(password || '') === CONFIG.ACCESS_PASSWORD;
}

// 会话 token = base64(payload).hmac 签名
async function signSession(payload, env) {
  const secret = getSecretKey(env) + ':session';
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const sig = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  return payload + '.' + sig;
}

async function verifySessionToken(token, env) {
  if (!token) return false;
  const idx = token.lastIndexOf('.');
  if (idx < 0) return false;
  const payload = token.slice(0, idx);
  const expected = await signSession(payload, env);
  return token === expected;
}

function parseCookies(request) {
  const header = request.headers.get('Cookie') || '';
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

// 会话 payload: expireTs 随机数（签名即可防篡改，过期时间放 payload 内）
function makeSessionPayload() {
  return 's' + Date.now() + '.' + crypto.randomUUID().slice(0, 8);
}

function sessionCookieHeader(token, maxAgeSeconds) {
  const attrs = [
    SESSION_COOKIE + '=' + token,
    'Path=/',
    'Max-Age=' + maxAgeSeconds,
    'HttpOnly',
    'SameSite=Lax',
  ];
  return attrs.join('; ');
}

// 检查请求是否已登录（会话 Cookie 有效）
async function isSessionValid(request, env) {
  const cookies = parseCookies(request);
  const token = cookies[SESSION_COOKIE];
  if (!token) return false;
  if (!(await verifySessionToken(token, env))) return false;
  const payload = token.split('.')[0];
  const ts = parseInt(payload.slice(1).split('.')[0], 10);
  if (isNaN(ts)) return false;
  return Date.now() - ts < SESSION_TTL;
}

// ==================== 认证/设置 API ====================

// POST /api/auth/login { username, password } -> 签发会话 Cookie
async function handleAuthLogin(request, bucket) {
  let body;
  try { body = await request.json(); } catch (e) {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
  const { username, password } = body;
  const ok = await verifyAuthPassword(bucket, String(username || '').trim(), String(password || ''));
  if (!ok) {
    return jsonResponse({ success: false, error: '账号或密码错误' }, 403);
  }
  const token = await signSession(makeSessionPayload(), {});
  const headers = {
    'Content-Type': 'application/json',
    'Set-Cookie': sessionCookieHeader(token, Math.floor(SESSION_TTL / 1000)),
    'Access-Control-Allow-Origin': '*',
  };
  return new Response(JSON.stringify({ success: true }), { headers });
}

// POST /api/auth/logout -> 清除会话
function handleAuthLogout() {
  return new Response(JSON.stringify({ success: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': sessionCookieHeader('', 0),
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// GET /api/settings -> 返回当前设置（密码不回传明文/哈希）
async function handleGetSettings(bucket) {
  const cfg = await getSiteConfig(bucket);
  return jsonResponse({
    authUser: cfg.authUser,
    bgUrl: cfg.bgUrl,
    hasCustomPassword: !!(cfg.authPassHash),
  });
}

// POST /api/settings { authUser?, newPassword?, bgUrl? } -> 保存设置（需已登录）
async function handleSaveSettings(request, bucket) {
  let body;
  try { body = await request.json(); } catch (e) {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
  const patch = {};
  if (typeof body.authUser === 'string' && body.authUser.trim()) {
    patch.authUser = body.authUser.trim();
  }
  if (typeof body.newPassword === 'string' && body.newPassword.length > 0) {
    const salt = generateSalt();
    patch.authPassHash = await hashPassword(body.newPassword, salt);
    patch.authPassSalt = salt;
  }
  if (typeof body.bgUrl === 'string') {
    patch.bgUrl = body.bgUrl.trim();
  }
  const saved = await saveSiteConfig(bucket, patch);
  return jsonResponse({
    success: true,
    authUser: saved.authUser,
    bgUrl: saved.bgUrl,
  });
}

// ==================== WebDAV 处理（配置同步） ====================

// WebDAV 路径转 R2 key（去除 /dav 前缀，做安全规范化，防止目录穿越）
function webdavPathToKey(davPath) {
  let p = davPath || '';
  // 去掉开头的斜杠
  p = p.replace(/^\/+/, '');
  // 拆段、丢弃空段与 '.'/'..'，防止越界访问
  const segments = p.split('/').filter((s) => s && s !== '.' && s !== '..');
  const normalized = segments.join('/');
  return CONFIG.WEBDAV_ROOT_KEY + normalized;
}

// 把 R2 key 转回 WebDAV 展示路径（不含 /dav 前缀）
function webdavKeyToPath(key) {
  const prefix = CONFIG.WEBDAV_ROOT_KEY;
  let rel = key.startsWith(prefix) ? key.slice(prefix.length) : key;
  rel = rel.replace(/\/+$/, '');
  return '/' + rel;
}

// 判断一个 R2 key 是否是目录占位对象（以 / 结尾）
function isDirectoryKey(key) {
  return key.endsWith('/');
}

function webdavAuthError() {
  return new Response('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="WebDAV"',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

function getWebDavPassword(env) {
  return CONFIG.WEBDAV_PASSWORD || env.WEBDAV_PASSWORD || '';
}

// Basic Auth 校验（WebDAV 客户端用）：账号/密码优先用站点配置，回退 CONFIG
// 返回 null = 通过；返回 Response = 401
async function checkWebDavBasicAuth(request, bucket) {
  const cfg = await getSiteConfig(bucket);
  const username = cfg.authUser || CONFIG.WEBDAV_USERNAME || '';
  const webdavPass = getWebDavPassword({});

  const authHeader = request.headers.get('Authorization') || '';
  const m = authHeader.match(/^Basic\s+(.+)$/i);
  if (!m) return webdavAuthError();

  let decoded = '';
  try {
    decoded = atob(m[1]);
  } catch (e) {
    return webdavAuthError();
  }

  const idx = decoded.indexOf(':');
  if (idx < 0) return webdavAuthError();
  const u = decoded.slice(0, idx);
  const p = decoded.slice(idx + 1);

  // 1) 与站点配置的账号密码哈希比对（设置里改的密码）
  if (u === username && cfg.authPassHash && cfg.authPassSalt) {
    const computed = await hashPassword(p, cfg.authPassSalt);
    if (computed === cfg.authPassHash) return null;
  }
  // 2) 回退：与 WEBDAV_PASSWORD 环境变量/CONFIG 比对
  if (webdavPass && u === username && p === webdavPass) return null;
  // 3) 回退：与全局 ACCESS_PASSWORD 比对（老部署兼容）
  if (CONFIG.ACCESS_PASSWORD && u === username && p === CONFIG.ACCESS_PASSWORD) return null;

  return webdavAuthError();
}

function webdavXmlEscape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function httpDate(d) {
  const t = d instanceof Date ? d : new Date(d);
  return t.toUTCString();
}

async function handleWebDav(request, env, bucket, path) {
  // 认证已在路由层完成（会话 Cookie 或 Basic Auth 二选一）

  // 去掉 /dav 前缀，得到 WebDAV 路径（保留尾部斜杠以区分目录）
  const davPath = path.slice(CONFIG.WEBDAV_PATH.length);
  const key = webdavPathToKey(davPath);
  const method = request.method.toUpperCase();

  switch (method) {
    case 'OPTIONS':
      return handleWebDavOptions();
    case 'PROPFIND':
      return handleWebDavPropfind(bucket, key, davPath, request);
    case 'GET':
      return handleWebDavGet(bucket, key);
    case 'HEAD':
      return handleWebDavHead(bucket, key);
    case 'PUT':
      return handleWebDavPut(request, bucket, key, davPath);
    case 'DELETE':
      return handleWebDavDelete(bucket, key);
    case 'MKCOL':
      return handleWebDavMkcol(bucket, key);
    case 'MOVE':
      return handleWebDavMove(request, bucket, key);
    case 'COPY':
      return handleWebDavCopy(request, bucket, key);
    case 'LOCK':
      return handleWebDavLock(request, env, key, davPath);
    case 'UNLOCK':
      return handleWebDavUnlock(request, env, key, davPath);
    default:
      return new Response('Method Not Allowed', {
        status: 405,
        headers: { 'Allow': 'OPTIONS, PROPFIND, GET, HEAD, PUT, DELETE, MKCOL, MOVE, COPY, LOCK, UNLOCK' },
      });
  }
}

function handleWebDavOptions() {
  return new Response(null, {
    status: 200,
    headers: {
      'DAV': '1,2',
      'Allow': 'OPTIONS, PROPFIND, GET, HEAD, PUT, DELETE, MKCOL, MOVE, COPY, LOCK, UNLOCK',
      'MS-Author-Via': 'DAV',
    },
  });
}

// 列出目录下的子项（带父级），返回 207 multi-status XML
async function handleWebDavPropfind(bucket, key, davPath, request) {
  // Depth: 0 只返回自身，1 返回直接子项（默认 1）
  const depth = request.headers.get('Depth') || '1';

  const responses = [];

  async function addResponse(itemKey, size, lastModified, isCollection) {
    const itemPath = webdavKeyToPath(itemKey);
    // 目录 href 统一带尾斜杠（WebDAV 惯例，客户端依赖它区分目录）
    const normalizedPath = isCollection && !itemPath.endsWith('/') ? itemPath + '/' : itemPath;
    const href = CONFIG.WEBDAV_PATH + (normalizedPath === '/' ? '/' : normalizedPath);
    responses.push(
      '<D:response>' +
        '<D:href>' + webdavXmlEscape(href) + '</D:href>' +
        '<D:propstat>' +
          '<D:prop>' +
            '<D:resourcetype>' + (isCollection ? '<D:collection/>' : '') + '</D:resourcetype>' +
            '<D:getcontentlength>' + (isCollection ? 0 : size) + '</D:getcontentlength>' +
            '<D:getlastmodified>' + httpDate(lastModified || new Date()) + '</D:getlastmodified>' +
            '<D:creationdate>' + httpDate(lastModified || new Date()) + '</D:creationdate>' +
            '<D:displayname>' + webdavXmlEscape(itemKey.split('/').filter(Boolean).pop() || '') + '</D:displayname>' +
          '</D:prop>' +
          '<D:status>HTTP/1.1 200 OK</D:status>' +
        '</D:propstat>' +
      '</D:response>'
    );
  }

  // 目标对象自身
  const targetObj = await bucket.head(key);
  if (targetObj) {
    const isCol = isDirectoryKey(key);
    await addResponse(key, targetObj.size || 0, targetObj.uploaded || new Date(), isCol);
  } else {
    // 目标不存在时，检查是否有以它为前缀的子对象（即它是一个"目录"）
    const prefix = key.endsWith('/') ? key : key + '/';
    const listed = await bucket.list({ prefix, limit: 1 });
    const isRoot = key === CONFIG.WEBDAV_ROOT_KEY;
    if (listed.objects.length > 0 || isRoot) {
      // 根目录在尚未写入任何占位对象时也按空目录返回，避免首次访问 404
      await addResponse(key.endsWith('/') ? key : key + '/', 0, new Date(), true);
    } else {
      return new Response('Not Found', { status: 404 });
    }
  }

  // Depth >= 1 时列出直接子项
  if (depth !== '0') {
    const listPrefix = key.endsWith('/') ? key : key + '/';
    let cursor;
    do {
      const listed = await bucket.list({ prefix: listPrefix, cursor, limit: 1000 });
      for (const obj of listed.objects) {
        const objKey = obj.key;
        if (objKey === listPrefix) continue;
        // 只取直接子项：去掉前缀与目录占位符的尾部斜杠后不应再包含 '/'
        const rel = objKey.slice(listPrefix.length).replace(/\/+$/, '');
        if (rel === '' || rel.includes('/')) continue;
        const isCol = isDirectoryKey(objKey);
        await addResponse(objKey, obj.size || 0, obj.uploaded || new Date(), isCol);
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
  }

  const xml = '<?xml version="1.0" encoding="utf-8"?>\n' +
    '<D:multistatus xmlns:D="DAV:">' + responses.join('') + '</D:multistatus>';
  return new Response(xml, {
    status: 207,
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}

async function handleWebDavGet(bucket, key) {
  const obj = await bucket.get(key);
  if (!obj) return new Response('Not Found', { status: 404 });

  const headers = {
    'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
    'Content-Length': String(obj.size),
    'ETag': obj.etag,
  };
  return new Response(obj.body, { headers });
}

async function handleWebDavHead(bucket, key) {
  const obj = await bucket.head(key);
  if (!obj) return new Response('Not Found', { status: 404 });
  const headers = {
    'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
    'Content-Length': String(obj.size),
    'ETag': obj.etag,
  };
  return new Response(null, { headers });
}

async function handleWebDavPut(request, bucket, key, davPath) {
  const body = request.body;
  if (!body) return new Response('Bad Request', { status: 400 });

  const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (contentLength > CONFIG.WEBDAV_MAX_FILE_SIZE) {
    return new Response('Payload Too Large', { status: 413 });
  }

  const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
  const now = new Date();

  await bucket.put(key, body, {
    httpMetadata: { contentType },
    customMetadata: {
      webdav: '1',
      lastModified: now.toISOString(),
    },
  });

  // 同步确保父目录占位对象存在（R2 无真目录，靠 / 结尾的占位对象模拟）
  await ensureParentDirectories(bucket, key);

  return new Response(null, { status: 201, headers: { 'ETag': '"' + Date.now().toString(36) + '"' } });
}

async function handleWebDavDelete(bucket, key) {
  // 如果是目录（尾部斜杠或按前缀存在子对象），递归删除
  const asDirKey = key.endsWith('/') ? key : key + '/';
  let deletedAny = false;

  const headTarget = await bucket.head(key);
  if (headTarget) {
    await bucket.delete(key);
    deletedAny = true;
  }

  let cursor;
  do {
    const listed = await bucket.list({ prefix: asDirKey, cursor, limit: 1000 });
    for (const obj of listed.objects) {
      await bucket.delete(obj.key);
      deletedAny = true;
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  if (!deletedAny) return new Response('Not Found', { status: 404 });
  return new Response(null, { status: 204 });
}

async function handleWebDavMkcol(bucket, key) {
  // 规范化成目录 key（末尾带 /）
  const dirKey = key.endsWith('/') ? key : key + '/';

  // 已存在同名对象则报冲突
  const existing = await bucket.head(dirKey);
  if (existing) return new Response('Conflict', { status: 405 });

  await bucket.put(dirKey, new Uint8Array(0), {
    httpMetadata: { contentType: 'httpd/unix-directory' },
    customMetadata: { webdav: '1', isDir: '1' },
  });

  await ensureParentDirectories(bucket, dirKey);
  return new Response(null, { status: 201 });
}

async function handleWebDavMove(request, bucket, key) {
  const destinationHeader = request.headers.get('Destination');
  if (!destinationHeader) return new Response('Destination required', { status: 400 });

  const destPath = extractWebDavPathFromDestination(destinationHeader);
  if (!destPath) return new Response('Bad Destination', { status: 400 });

  const destKey = webdavPathToKey(destPath);
  if (destKey === key) return new Response(null, { status: 204 });

  const overwrite = request.headers.get('Overwrite');
  const allowOverwrite = !overwrite || overwrite.toUpperCase() !== 'F';

  // 目录移动：递归复制+删除
  const isDir = key.endsWith('/');
  const keysToMove = [];

  if (isDir) {
    let cursor;
    const prefix = key;
    do {
      const listed = await bucket.list({ prefix, cursor, limit: 1000 });
      for (const obj of listed.objects) keysToMove.push(obj.key);
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
    if (keysToMove.length === 0) {
      const headDir = await bucket.head(key);
      if (headDir) keysToMove.push(key);
    }
  } else {
    keysToMove.push(key);
  }

  if (keysToMove.length === 0) return new Response('Not Found', { status: 404 });

  // 目标存在且不允许覆盖
  if (!allowOverwrite) {
    const destHead = await bucket.head(destKey) || await bucket.head(destKey + '/');
    if (destHead) return new Response('Precondition Failed', { status: 412 });
  }

  for (const srcKey of keysToMove) {
    const rel = srcKey.slice(key.length);
    const newKey = destKey.endsWith('/') ? destKey + rel : destKey + rel;
    const obj = await bucket.get(srcKey);
    if (!obj) continue;
    await bucket.put(newKey, obj.body, {
      httpMetadata: obj.httpMetadata,
      customMetadata: obj.customMetadata,
    });
    await bucket.delete(srcKey);
  }

  await ensureParentDirectories(bucket, destKey);
  return new Response(null, { status: 201 });
}

async function handleWebDavCopy(request, bucket, key) {
  const destinationHeader = request.headers.get('Destination');
  if (!destinationHeader) return new Response('Destination required', { status: 400 });

  const destPath = extractWebDavPathFromDestination(destinationHeader);
  if (!destPath) return new Response('Bad Destination', { status: 400 });

  const destKey = webdavPathToKey(destPath);
  if (destKey === key) return new Response(null, { status: 204 });

  const overwrite = request.headers.get('Overwrite');
  const allowOverwrite = !overwrite || overwrite.toUpperCase() !== 'F';

  if (!allowOverwrite) {
    const destHead = await bucket.head(destKey);
    if (destHead) return new Response('Precondition Failed', { status: 412 });
  }

  const obj = await bucket.get(key);
  if (!obj) return new Response('Not Found', { status: 404 });

  await bucket.put(destKey, obj.body, {
    httpMetadata: obj.httpMetadata,
    customMetadata: obj.customMetadata,
  });
  await ensureParentDirectories(bucket, destKey);
  return new Response(null, { status: 201 });
}

// LOCK 用 KV 存锁 token（如果未绑定 KV 则降级为内存级空实现，返回不支持）
async function handleWebDavLock(request, env, key, davPath) {
  const lockNs = env.WEBDAV_LOCKS;
  if (!lockNs) {
    // 未绑定 KV 时，返回 405 不支持锁定；多数配置同步客户端可容忍
    return new Response('Lock not supported', { status: 405 });
  }

  const token = 'opaquelocktoken:' + crypto.randomUUID();
  const timeout = parseTimeout(request.headers.get('Timeout'));
  const now = Date.now();
  const expire = now + (timeout > 0 ? timeout : 5 * 60 * 1000);

  await lockNs.put('lock:' + key, JSON.stringify({
    token,
    expire,
    owner: 'webdav-sync',
  }));

  const lockXml = '<?xml version="1.0" encoding="utf-8"?>\n' +
    '<D:prop xmlns:D="DAV:">' +
      '<D:lockdiscovery>' +
        '<D:activelock>' +
          '<D:locktype><D:write/></D:locktype>' +
          '<D:lockscope><D:exclusive/></D:lockscope>' +
          '<D:depth>infinity</D:depth>' +
          '<D:owner><D:href>webdav-sync</D:href></D:owner>' +
          '<D:timeout>Second-' + Math.floor((expire - now) / 1000) + '</D:timeout>' +
          '<D:locktoken><D:href>' + webdavXmlEscape(token) + '</D:href></D:locktoken>' +
        '</D:activelock>' +
      '</D:lockdiscovery>' +
    '</D:prop>';
  return new Response(lockXml, {
    status: 200,
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Lock-Token': '<' + token + '>' },
  });
}

async function handleWebDavUnlock(request, env, key, davPath) {
  const lockNs = env.WEBDAV_LOCKS;
  if (!lockNs) return new Response('Lock not supported', { status: 405 });

  const lockTokenHeader = request.headers.get('Lock-Token') || '';
  const m = lockTokenHeader.match(/<([^>]+)>/);
  const token = m ? m[1] : '';

  const existing = await lockNs.get('lock:' + key);
  if (existing) {
    const lockData = JSON.parse(await existing.text());
    if (!token || lockData.token === token || token.replace('opaquelocktoken:', '') === lockData.token.replace('opaquelocktoken:', '')) {
      await lockNs.delete('lock:' + key);
      return new Response(null, { status: 204 });
    }
  }
  return new Response('Lock not found', { status: 409 });
}

// 解析 Timeout 头，返回毫秒；无法解析返回 -1
function parseTimeout(header) {
  if (!header) return -1;
  const m = String(header).match(/Second-(\d+)/i);
  return m ? parseInt(m[1], 10) * 1000 : -1;
}

// 从 Destination 头提取 WebDAV 路径（去掉 scheme/host 和 /dav 前缀）
function extractWebDavPathFromDestination(destinationHeader) {
  let dest = destinationHeader.trim();
  // 去掉 < > 包裹
  if (dest.startsWith('<') && dest.endsWith('>')) dest = dest.slice(1, -1);
  try {
    const u = new URL(dest);
    dest = u.pathname;
  } catch (e) {
    // 可能只是路径
  }
  if (dest.startsWith(CONFIG.WEBDAV_PATH)) {
    dest = dest.slice(CONFIG.WEBDAV_PATH.length);
  }
  return dest;
}

// 确保父目录占位对象存在（R2 无真目录）
async function ensureParentDirectories(bucket, key) {
  const segments = key.split('/').filter((s) => s && s !== '.' && s !== '..');
  // 最后一个段是文件名/目录本身，父目录是其之前的段
  const parents = segments.slice(0, -1);
  let acc = '';
  for (const seg of parents) {
    acc += seg + '/';
    const dirKey = acc;
    const existing = await bucket.head(dirKey);
    if (!existing) {
      await bucket.put(dirKey, new Uint8Array(0), {
        httpMetadata: { contentType: 'httpd/unix-directory' },
        customMetadata: { webdav: '1', isDir: '1' },
      });
    }
  }
}

async function handleDownload(request, env, bucket, fileId, baseUrl) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const expires = url.searchParams.get('expires');

  const metaKey = '_meta/' + fileId;
  const meta = await bucket.get(metaKey);

  if (!meta) {
    return new Response('File not found', { status: 404 });
  }

  const metaData = JSON.parse(await meta.text());

  // 检查文件是否过期
  if (metaData.expireTime && metaData.expireTime < Date.now()) {
    await deleteFileWithChunks(bucket, metaData, metaKey);
    return new Response('File expired', { status: 410 });
  }

  // 检查文件是否上传完成
  if (!metaData.uploaded) {
    return new Response('File upload incomplete', { status: 400 });
  }

  // 如果有有效的临时token，直接返回文件（用于实际下载）
  if (token && expires) {
    const isValid = await verifyTempToken(fileId, expires, token, env);
    if (isValid && parseInt(expires) > Date.now()) {
      return serveFile(bucket, metaData);
    }
  }

  // 无有效token时，显示文件详情页
  return new Response(
    getFileDetailHtml(
      fileId,
      metaData.filename,
      metaData.size,
      !!metaData.passwordHash,
      metaData.uploadTime
    ),
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

async function serveFile(bucket, metaData) {
  // 如果是分片文件，需要按顺序读取所有分片
  if (metaData.isMultipart && metaData.totalChunks > 0) {
    return serveMultipartFile(bucket, metaData);
  }

  const fileObj = await bucket.get(metaData.key);
  if (!fileObj) {
    return new Response('File not found', { status: 404 });
  }

  const headers = {
    'Content-Type': metaData.type || 'application/octet-stream',
    'Content-Length': String(metaData.size),
    'Content-Disposition': 'attachment; filename="' + encodeURIComponent(metaData.filename) + '"',
    'Cache-Control': 'public, max-age=31536000',
    'ETag': fileObj.etag
  };

  return new Response(fileObj.body, { headers });
}

// 分片文件下载：按顺序流式读取所有分片
async function serveMultipartFile(bucket, metaData) {
  const key = metaData.key;
  const totalChunks = metaData.totalChunks;
  const totalSize = Number(metaData.size) || 0;

  // 分片拼接：用 FixedLengthStream + 原生 pipeTo（零拷贝直通）
  // 旧实现是 reader.read() -> controller.enqueue() 的逐块 JS 循环，
  // 每字节都要过一遍 JS，大文件（>200MB）会撞 Worker CPU 时间上限
  // （tail 实测 outcome=exceededCpu / "Worker exceeded CPU time limit"），
  // 表现为 200 响应但在随机位置静默截断。
  const FixedLen = (typeof FixedLengthStream !== 'undefined') ? FixedLengthStream : null;
  let stream;

  if (FixedLen && totalSize > 0) {
    const { readable, writable } = new FixedLen(totalSize);
    const pump = (async () => {
      for (let i = 0; i < totalChunks; i++) {
        const chunk = await bucket.get(key + '.part.' + i);
        if (!chunk) throw new Error('Chunk ' + i + ' not found');
        await chunk.body.pipeTo(writable, { preventClose: true });
      }
      await writable.close();
    })();
    pump.catch((err) => {
      try { writable.abort(err); } catch (e) { /* 已关闭 */ }
    });
    stream = readable;
  } else {
    // 回退：环境没有 FixedLengthStream 时用旧的 JS 循环
    stream = new ReadableStream({
      async start(controller) {
        try {
          for (let i = 0; i < totalChunks; i++) {
            const chunkKey = key + '.part.' + i;
            const chunk = await bucket.get(chunkKey);

            if (!chunk) {
              controller.error(new Error('Chunk ' + i + ' not found'));
              return;
            }

            // 读取分片内容并写入流
            const reader = chunk.body.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      }
    });
  }

  const headers = {
    'Content-Type': metaData.type || 'application/octet-stream',
    'Content-Length': String(metaData.size),
    'Content-Disposition': 'attachment; filename="' + encodeURIComponent(metaData.filename) + '"',
    'Cache-Control': 'public, max-age=31536000'
  };

  return new Response(stream, { headers });
}

function jsonResponse(data, status) {
  status = status || 200;
  return new Response(JSON.stringify(data), {
    status: status,
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
