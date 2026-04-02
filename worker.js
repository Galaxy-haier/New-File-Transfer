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
  CUSTOM_DOMAIN: '',

  // 最大并发上传数
  MAX_CONCURRENT_UPLOADS: 3,

  // 分片上传配置
  // 分片大小（字节）默认 50MB，Cloudflare Workers 限制单个请求 100MB，建议不超过 50MB
  CHUNK_SIZE: 50 * 1024 * 1024,
  // 启用分片上传的文件大小阈值（字节）默认 100MB
  MULTIPART_THRESHOLD: 100 * 1024 * 1024,
};

const FAVICON_DATA_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath fill='%2338BDF8' d='M8 16.5A4.5 4.5 0 0 1 12.5 12H25l5.2 5.2H51.5A4.5 4.5 0 0 1 56 21.7v24.8A5.5 5.5 0 0 1 50.5 52h-37A5.5 5.5 0 0 1 8 46.5v-30Z'/%3E%3Cpath fill='%230EA5E9' d='M8 24.5A5.5 5.5 0 0 1 13.5 19H50.2A5.8 5.8 0 0 1 56 24.8v21.7A5.5 5.5 0 0 1 50.5 52h-37A5.5 5.5 0 0 1 8 46.5v-22Z'/%3E%3C/svg%3E";

// ==================== HTML 模板 ====================
const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
  <title>文件中转站 |New File Transfer</title>
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
    .btn-qr:disabled {
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
    
    /* Password Modal */
    .password-modal {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    }
    
    .password-box {
      background: var(--bg-card);
      backdrop-filter: blur(20px);
      border: 1px solid var(--border-color);
      padding: 40px;
      border-radius: 20px;
      text-align: center;
      max-width: 420px;
      width: 90%;
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
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
        <p>请输入访问密码以继续使用</p>
        <input type="password" class="password-input" id="passwordInput" placeholder="输入密码..." autofocus>
        <button class="btn-primary" onclick="verifyPassword()">进入系统</button>
      </div>
    </div>

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
      itemDiv.querySelectorAll('.btn-qr, .btn-delete').forEach((btn) => {
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
      resultDiv.innerHTML = '<div class="file-result-link"><input class="download-link-input" type="text" readonly value="' + safeUrl + '"></div><div class="file-result-actions"><button class="btn-sm btn-qr" type="button">🔲 分享二维码</button><button class="btn-sm btn-delete" type="button">🗑 删除</button></div>' + passwordBadge;
      resultDiv.style.display = 'flex';
      resultDiv.style.flexWrap = '';

      registerFileExpiry(fileId, expireTime);

      const linkInput = resultDiv.querySelector('.download-link-input');
      if (linkInput) {
        linkInput.addEventListener('click', () => {
          linkInput.select();
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

    window.verifyPassword = async function() {
      const input = document.getElementById('passwordInput');
      const password = input.value;
      try {
        const res = await fetch('/api/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const data = await res.json();
        if (data.success) {
          document.getElementById('passwordModal').classList.add('hidden');
          initApp();
        } else {
          showToast('密码错误', 'error');
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
      if (CONFIG.ACCESS_PASSWORD) {
        document.getElementById('passwordModal').classList.remove('hidden');
      } else {
        initApp();
      }
    });
  </script>
</body>
</html>`;

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

// ==================== 主处理函数 ====================

export default {
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

      if (path.startsWith('/api/')) {
        return handleApi(request, env, bucket, baseUrl, path);
      }

      if (path.startsWith('/d/')) {
        const fileId = path.slice(3).split('?')[0];
        return handleDownload(request, env, bucket, fileId, baseUrl);
      }

      return new Response(HTML_TEMPLATE, {
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

  // 创建 ReadableStream 来流式返回所有分片
  const stream = new ReadableStream({
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
