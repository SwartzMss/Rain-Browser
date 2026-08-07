# Rain-Browser

[简体中文](#简体中文) | [English](#english)

Rain-Browser 是一个 Chrome / Edge 浏览器扩展，用于把网页中的日志和诊断文件直接导入 Rain，省去“先下载到本地，再手动上传”的步骤。

Rain-Browser is a Chrome / Edge extension that imports web-hosted logs and diagnostic files directly into Rain, removing the manual download-and-reupload step.

---

# 简体中文

## 功能简介

Rain-Browser 当前 MVP 支持：

- 扫描当前网页中的普通 `<a href>` 下载链接；
- 识别常见日志、诊断文件和压缩包，例如 `.log`、`.txt`、`.zip`、`.tar.gz`、`.tgz`、`.gz`、`.7z`、`.json`、`.trace`、`.dmp`、`.dump`；
- 选择一个或多个发现的资源；
- 复用浏览器中已有的 Rain 登录 Session；
- 自动创建 Rain Issue；
- 在浏览器侧获取目标文件；
- 通过 Rain 真实上传接口导入文件；
- 继续复用 Rain 原有的解压、索引和日志处理流程。

## 为什么需要 Rain-Browser

很多日志并不在本地，而是放在 Jira、Jenkins、测试平台、内部缺陷系统或其他 Web 服务中。

传统流程通常是：

```text
找到日志
  ↓
下载到本地
  ↓
打开 Rain
  ↓
创建 Issue
  ↓
重新上传日志
```

Rain-Browser 希望把流程缩短为：

```text
找到日志
  ↓
点击「导入 Rain」
  ↓
完成
```

## 导入流程

```text
外部日志页面
      |
      | 扫描下载链接
      v
Rain-Browser
      |
      | GET /api/auth/me
      v
检查已有 Rain 登录状态
      |
      | POST /api/issues
      v
创建 Issue
      |
      | browser fetch(source URL)
      v
File / Blob
      |
      | multipart/form-data
      v
POST /api/issues/{issue_code}/uploads
      |
      v
Rain 原有处理流程
```

扩展不会保存 Rain 用户名或密码。Rain 身份认证继续以已有的 `rain_session` HttpOnly Cookie 为准，请求通过 `credentials: "include"` 复用当前登录状态。

## 本地安装

1. Clone 本仓库：

```bash
git clone https://github.com/SwartzMss/Rain-Browser.git
```

2. 打开 Chrome 或 Edge 扩展管理页面：

```text
chrome://extensions
```

3. 开启 **开发者模式（Developer mode）**。
4. 点击 **加载已解压的扩展程序（Load unpacked）**。
5. 选择 `Rain-Browser` 仓库目录。
6. 在同一个浏览器中打开 Rain 并登录。
7. 打开 Rain-Browser；如果 Rain 不是运行在 `http://127.0.0.1:8080`，配置实际 Rain 地址。
8. 打开包含日志下载链接的网页。
9. 选择需要的文件并点击 **导入 Rain**。

## 使用的 Rain API

### 检查登录状态

```http
GET /api/auth/me
```

已登录时返回类似：

```json
{
  "authenticated": true,
  "user": {
    "id": "...",
    "username": "...",
    "role": "USER"
  }
}
```

游客也会返回 HTTP 200，但：

```json
{
  "authenticated": false,
  "user": null
}
```

Rain-Browser 会把这种情况视为未登录，并提示用户先登录 Rain。

### 创建 Issue

```http
POST /api/issues
Content-Type: application/json
X-Rain-Browser: 1
```

示例：

```json
{
  "code": "RAIN-1754568620000",
  "name": "Browser Import 2026-08-07T12:34:56.000Z"
}
```

### 上传文件

```http
POST /api/issues/{issue_code}/uploads
Content-Type: multipart/form-data
X-Rain-Browser: 1
```

文件通过 multipart 的 `files` 字段上传，之后继续进入 Rain 原有的后台解压、索引和处理流程。

## 安全设计

Rain-Browser 不绕过 Rain 原有权限体系：

- 扩展不保存 Rain 用户名和密码；
- Rain 的 HttpOnly Session Cookie 仍然是身份认证依据；
- 游客依然不能创建 Issue 或上传文件；
- Rain 原有 same-origin 防护继续启用；
- Rain-Browser 的写请求使用 `X-Rain-Browser: 1` 标记；
- Rain 只对合法的 `chrome-extension://<extension-id>` 来源识别该扩展请求；
- 普通跨域网页请求依旧会被拒绝。

当前 MVP 为了能够发现和读取任意内部网站上的日志，暂时使用较宽的 `<all_urls>` host permission。正式发布前应考虑改为 optional host permissions 或进一步缩小权限范围。

## 当前限制

- 主要识别普通 `<a href>` 类型的文件链接；
- 暂未完整支持 JavaScript 动态生成的下载按钮；
- 暂未针对 Jira、Jenkins 等平台提供专用适配器；
- 当前每次导入默认创建新的 Rain Issue；
- 尚未完成针对所有企业 SSO / 特殊 Cookie 策略的兼容验证。

## Roadmap

- **V0.1**：扫描普通网页文件链接并上传到真实 Rain API；
- **V0.2**：支持选择已有 Issue，而不是始终创建新 Issue；
- **V0.3**：识别动态下载资源和 API 驱动的下载按钮；
- **V0.4**：适配 Jira、Jenkins 和内部诊断平台的认证下载；
- **V0.5**：将永久 `<all_urls>` 权限逐步替换为 optional host permissions；
- **V0.6**：根据页面信息自动生成更合理的 Issue Code / Issue Name。

---

# English

## Overview

Rain-Browser currently provides the following MVP capabilities:

- Scan ordinary `<a href>` download links on the current page;
- Detect common log, diagnostic, and archive formats such as `.log`, `.txt`, `.zip`, `.tar.gz`, `.tgz`, `.gz`, `.7z`, `.json`, `.trace`, `.dmp`, and `.dump`;
- Select one or more discovered resources;
- Reuse the user's existing Rain login session;
- Create a Rain Issue automatically;
- Fetch the source file from the browser context;
- Upload the file through Rain's real upload API;
- Reuse Rain's existing extraction, indexing, and log-processing pipeline.

## Why Rain-Browser

Logs are often hosted on Jira, Jenkins, test platforms, internal issue trackers, or other web services instead of being stored locally.

The traditional workflow is usually:

```text
Find log
  ↓
Download locally
  ↓
Open Rain
  ↓
Create Issue
  ↓
Upload the log again
```

Rain-Browser reduces it to:

```text
Find log
  ↓
Click "Import to Rain"
  ↓
Done
```

## Import Flow

```text
External log page
      |
      | scan download links
      v
Rain-Browser
      |
      | GET /api/auth/me
      v
Check existing Rain session
      |
      | POST /api/issues
      v
Create Issue
      |
      | browser fetch(source URL)
      v
File / Blob
      |
      | multipart/form-data
      v
POST /api/issues/{issue_code}/uploads
      |
      v
Rain processing pipeline
```

The extension never stores the Rain username or password. Authentication continues to rely on the existing `rain_session` HttpOnly cookie, reused with `credentials: "include"`.

## Local Installation

1. Clone this repository:

```bash
git clone https://github.com/SwartzMss/Rain-Browser.git
```

2. Open the Chrome or Edge extension page:

```text
chrome://extensions
```

3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the `Rain-Browser` repository directory.
6. Open Rain in the same browser and log in.
7. Open Rain-Browser and configure the Rain server URL if Rain is not running at `http://127.0.0.1:8080`.
8. Visit a page containing log download links.
9. Select the desired files and click **Import to Rain**.

## Rain APIs Used

### Check Authentication

```http
GET /api/auth/me
```

Authenticated response example:

```json
{
  "authenticated": true,
  "user": {
    "id": "...",
    "username": "...",
    "role": "USER"
  }
}
```

Guests also receive HTTP 200, but with:

```json
{
  "authenticated": false,
  "user": null
}
```

Rain-Browser treats this response as not logged in and asks the user to log in to Rain first.

### Create Issue

```http
POST /api/issues
Content-Type: application/json
X-Rain-Browser: 1
```

Example:

```json
{
  "code": "RAIN-1754568620000",
  "name": "Browser Import 2026-08-07T12:34:56.000Z"
}
```

### Upload File

```http
POST /api/issues/{issue_code}/uploads
Content-Type: multipart/form-data
X-Rain-Browser: 1
```

The file is uploaded through the multipart `files` field and then continues through Rain's normal background extraction, indexing, and processing pipeline.

## Security Model

Rain-Browser does not bypass Rain's existing authorization model:

- The extension never stores Rain usernames or passwords;
- Rain's HttpOnly session cookie remains authoritative;
- Guests still cannot create Issues or upload files;
- Rain's normal same-origin protection remains enabled;
- Rain-Browser write requests are marked with `X-Rain-Browser: 1`;
- Rain only recognizes this extension path for syntactically valid `chrome-extension://<extension-id>` origins;
- Ordinary cross-origin web requests remain rejected.

The current MVP requests broad `<all_urls>` host permission so that it can discover and fetch logs from arbitrary internal sites. Before public distribution, this should be reduced or migrated to optional host permissions where practical.

## Current Limitations

- Primarily detects ordinary `<a href>` file links;
- JavaScript-generated download buttons are not fully supported yet;
- No dedicated Jira or Jenkins adapters yet;
- Each import currently creates a new Rain Issue by default;
- Compatibility with every enterprise SSO and special cookie policy has not yet been validated.

## Roadmap

- **V0.1**: scan ordinary page links and upload them to the real Rain API;
- **V0.2**: allow selecting an existing Issue instead of always creating a new one;
- **V0.3**: detect dynamically generated resources and API-backed download buttons;
- **V0.4**: improve authenticated downloads for Jira, Jenkins, and internal diagnostic platforms;
- **V0.5**: migrate permanent `<all_urls>` access toward optional host permissions;
- **V0.6**: derive better Issue Code / Issue Name values from page context.
