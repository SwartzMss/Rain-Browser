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
- 新建 Rain Issue，或选择当前登录用户拥有写权限的已有 Issue；
- 根据页面标题、URL 等信息识别类似 `BUG-1234` 的 Issue Code，并优先匹配当前用户可写的同名 Issue；
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
创建或找到 Issue
  ↓
重新上传日志
```

Rain-Browser 希望把流程缩短为：

```text
找到日志
  ↓
选择目标 Issue
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
      | GET /api/issues
      v
只展示 can_write=true 的已有 Issue
      |
      +---- 选择已有 Issue
      |
      +---- 或 POST /api/issues 新建 Issue
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

已有 Issue 不只是前端过滤：上传前插件还会重新获取一次当前用户可写 Issue；Rain 后端本身也会再次校验 Issue owner，因此其他用户的 Issue 不会因为插件 UI 或缓存状态而获得上传权限。

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
9. 选择已有 Issue 或新建 Issue。
10. 选择需要的文件并点击 **导入 Rain**。

## 使用的 Rain API

### 检查登录状态

```http
GET /api/auth/me
```

游客也会返回 HTTP 200，但 `authenticated: false`。Rain-Browser 会把这种情况视为未登录。

### 获取 Issue

```http
GET /api/issues
```

Rain-Browser 只把响应中 `can_write: true` 的 Issue 放进“目标 Issue”选择框。其他用户的 Issue 即使可浏览，也不会显示为上传目标。

### 创建 Issue

```http
POST /api/issues
Content-Type: application/json
X-Rain-Browser: 1
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
- 已有 Issue 选择只展示 `can_write=true` 的 Issue；
- 上传前会重新检查已有 Issue 是否仍然可写；
- Rain 后端继续执行 Issue owner 权限校验；
- Rain 原有 same-origin 防护继续启用；
- Rain-Browser 的写请求使用 `X-Rain-Browser: 1` 标记；
- 普通跨域网页请求依旧会被拒绝。

当前 MVP 为了能够发现和读取任意内部网站上的日志，暂时使用较宽的 `<all_urls>` host permission。正式发布前应考虑改为 optional host permissions 或进一步缩小权限范围。

## 当前限制

- 主要识别普通 `<a href>` 类型的文件链接；
- 暂未完整支持 JavaScript 动态生成的下载按钮；
- 暂未针对 Jira、Jenkins 等平台提供专用适配器；
- 页面 Issue Code 自动识别当前只使用通用规则，尚未做平台专用解析；
- 尚未完成针对所有企业 SSO / 特殊 Cookie 策略的兼容验证；
- 大文件目前仍采用 `fetch -> Blob -> File -> multipart`，后续需要评估超大日志的浏览器内存占用。

## Roadmap

- **V0.1 ✅**：扫描普通网页文件链接并上传到真实 Rain API；
- **V0.2 ✅**：支持选择当前用户可写的已有 Issue，并提供通用页面 Issue Code 自动匹配；
- **V0.3**：识别动态下载资源和 API 驱动的下载按钮；
- **V0.4**：适配 Jira、Jenkins 和内部诊断平台的认证下载与页面信息解析；
- **V0.5**：将永久 `<all_urls>` 权限逐步替换为 optional host permissions；
- **V0.6**：继续增强 Issue Code / Issue Name 自动提取规则与平台 Adapter。

---

# English

## Overview

Rain-Browser currently supports:

- scanning ordinary `<a href>` download links on the current page;
- detecting common log, diagnostic, and archive formats;
- selecting one or more discovered resources;
- reusing the existing Rain login session;
- creating a new Rain Issue or selecting an existing Issue writable by the current user;
- recognizing generic Issue Codes such as `BUG-1234` from page titles and URLs and matching them against writable Issues;
- fetching the source file in the browser context;
- uploading files through Rain's real upload API;
- reusing Rain's normal extraction, indexing, and processing pipeline.

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
Check Rain session
      |
      | GET /api/issues
      v
Show only can_write=true Issues
      |
      +---- select existing Issue
      |
      +---- or POST /api/issues
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

Existing Issue selection is not only a UI filter. Rain-Browser revalidates writable Issues immediately before upload, and Rain itself still enforces Issue ownership on the upload endpoint.

## Local Installation

1. Clone this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the `Rain-Browser` repository directory.
6. Open Rain in the same browser and log in.
7. Configure the Rain server URL if needed.
8. Visit a page containing log links.
9. Select an existing writable Issue or create a new one.
10. Select files and click **Import to Rain**.

## Rain APIs Used

### Authentication

```http
GET /api/auth/me
```

### Issue List

```http
GET /api/issues
```

Only Issues with `can_write: true` are shown as upload targets.

### Create Issue

```http
POST /api/issues
Content-Type: application/json
X-Rain-Browser: 1
```

### Upload File

```http
POST /api/issues/{issue_code}/uploads
Content-Type: multipart/form-data
X-Rain-Browser: 1
```

Files are uploaded through the multipart `files` field.

## Security Model

- Rain credentials are never stored by the extension;
- Rain's HttpOnly session cookie remains authoritative;
- guests cannot create Issues or upload files;
- only `can_write=true` Issues are presented as existing upload targets;
- writable Issue state is revalidated before upload;
- Rain still enforces Issue ownership server-side;
- Rain's same-origin protection remains enabled;
- Rain-Browser write requests use the `X-Rain-Browser: 1` marker;
- ordinary cross-origin web writes remain rejected.

The current MVP still requests broad `<all_urls>` host permission. This should be reduced or migrated to optional host permissions before public distribution.

## Current Limitations

- primarily detects ordinary `<a href>` file links;
- JavaScript-generated download buttons are not fully supported yet;
- no dedicated Jira or Jenkins adapters yet;
- generic Issue Code inference is intentionally simple;
- enterprise SSO and special cookie policies still require real-world validation;
- large files currently use `fetch -> Blob -> File -> multipart`, so very large logs need memory-usage testing.

## Roadmap

- **V0.1 ✅**: scan ordinary page links and upload them to the real Rain API;
- **V0.2 ✅**: select existing writable Issues and perform generic page Issue Code matching;
- **V0.3**: detect dynamically generated resources and API-backed download buttons;
- **V0.4**: add Jira, Jenkins, and internal-platform authenticated download and page parsing adapters;
- **V0.5**: migrate permanent `<all_urls>` access toward optional host permissions;
- **V0.6**: further improve Issue Code / Issue Name extraction and platform adapters.
