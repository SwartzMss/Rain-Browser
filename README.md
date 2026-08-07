# Rain Browser

[中文](#中文) · [English](#english)

---

## 中文

Rain Browser 是一个 Chrome / Edge Manifest V3 浏览器扩展，用于识别网页上的日志、诊断包和转储文件，并直接导入到 Rain。

### 当前能力

- **V0.1**：扫描普通网页文件链接并上传到真实 Rain API；
- **V0.2**：支持选择当前用户拥有写权限的已有 Issue，或创建新 Issue；
- 根据页面标题、URL 和链接文本尝试识别类似 `BUG-1234` 的 Issue Code；
- 自动使用当前浏览器中的 Rain 登录会话；
- 支持 `.log`、`.txt`、`.zip`、`.tar.gz`、`.tgz`、`.gz`、`.7z`、`.json`、`.trace`、`.dmp`、`.dump`；
- 支持一次选择并顺序导入多个文件。

### 固定扩展 ID

Rain Browser 在 `manifest.json` 中设置了固定的 `key`，开发环境下加载 unpacked extension 时会保持稳定的 Extension ID：

```text
adfphmgiamoclnhibdebknkemmihpakg
```

Rain 可以使用这个 ID 区分官方 Rain Browser 与其他 Chrome 扩展。不要随意修改 `manifest.json` 中的 `key`；修改后 Extension ID 会变化，并导致 Rain 的来源校验失败。

如果未来发布到 Chrome Web Store，应使用 Web Store 对应的公钥重新确认最终 Extension ID，并同步更新 Rain 的允许 ID。

### 导入流程

```text
网页
  ↓
Rain Browser 扫描候选日志
  ↓
浏览器使用源站登录态获取文件
  ↓
Rain Browser 使用当前 Rain Session 调用 Rain API
  ↓
创建或选择可写 Issue
  ↓
上传文件
```

### Rain API

当前使用：

```text
GET  /api/auth/me
GET  /api/issues
POST /api/issues
POST /api/issues/{issue_code}/uploads
```

上传接口的 multipart 文件字段为：

```text
files
```

### 权限模型

已有 Issue 下拉列表只展示 Rain 返回的：

```text
can_write = true
```

在真正上传前插件还会重新读取一次可写 Issue，避免页面打开期间权限变化。

Rain 后端仍然是最终授权方；插件侧过滤只是 UI 和提前校验。

### 安全模型

- 插件复用当前浏览器中的 `rain_session`，不保存 Rain 密码；
- 文件下载优先使用浏览器已有的源站 Cookie / SSO / VPN 环境；
- Rain 写请求使用 `X-Rain-Browser: 1` 作为客户端标记；
- Rain 应同时校验固定的 Chrome Extension Origin，而不是仅信任这个 Header；
- 不建议为此开启通用的 credentialed CORS；
- Guest 用户不能创建 Issue 或上传；
- Rain 的 Issue ownership / `can_write` 权限仍然生效。

### Roadmap

- **V0.1**：扫描普通网页文件链接并上传到真实 Rain API；
- **V0.2**：支持选择已有 Issue，而不是始终创建新 Issue；
- **V0.3**：识别动态下载资源和 API 驱动的下载按钮；
- **V0.4**：适配 Jira、Jenkins 和内部诊断平台的认证下载；
- **V0.5**：将永久 `<all_urls>` 权限逐步替换为 optional host permissions；
- **V0.6**：根据页面信息自动生成更合理的 Issue Code / Issue Name。

---

## English

Rain Browser is a Chrome / Edge Manifest V3 extension that detects web-hosted logs, diagnostic archives, and dump files and imports them directly into Rain.

### Current capabilities

- **V0.1**: scan ordinary file links and upload them to the real Rain API;
- **V0.2**: select an existing writable Issue owned by the current user, or create a new Issue;
- infer Issue Codes such as `BUG-1234` from page title, URL, and link text;
- reuse the current browser Rain session;
- recognize `.log`, `.txt`, `.zip`, `.tar.gz`, `.tgz`, `.gz`, `.7z`, `.json`, `.trace`, `.dmp`, and `.dump`;
- import multiple selected files sequentially.

### Stable extension ID

Rain Browser pins a `key` in `manifest.json`, so the unpacked extension keeps a stable development Extension ID:

```text
adfphmgiamoclnhibdebknkemmihpakg
```

Rain can use this ID to distinguish the official Rain Browser from other Chrome extensions. Do not casually change the manifest `key`; doing so changes the Extension ID and breaks Rain's origin validation.

If the extension is later published through the Chrome Web Store, use the Store public key to confirm the final Extension ID and update Rain's allowlisted ID if necessary.

### Import flow

```text
Web page
  ↓
Rain Browser scans candidate logs
  ↓
Browser fetches the source using the source-site session
  ↓
Rain Browser calls Rain APIs using the current Rain session
  ↓
Create or select a writable Issue
  ↓
Upload files
```

### Rain APIs

Currently used:

```text
GET  /api/auth/me
GET  /api/issues
POST /api/issues
POST /api/issues/{issue_code}/uploads
```

The multipart file field used by the upload API is:

```text
files
```

### Permission model

The existing-Issue selector only exposes Rain Issues where:

```text
can_write = true
```

Immediately before uploading to an existing Issue, the extension refreshes the writable Issue list to catch permission changes.

Rain remains the final authorization authority; extension-side filtering is only UX and early validation.

### Security model

- The extension reuses the current browser `rain_session` and does not store the Rain password;
- source downloads reuse the browser's source-site Cookie / SSO / VPN environment where possible;
- Rain write requests carry `X-Rain-Browser: 1` as a client marker;
- Rain should also validate the fixed Chrome Extension Origin instead of trusting that Header alone;
- generic credentialed CORS should not be enabled for this integration;
- guest users still cannot create Issues or upload files;
- Rain Issue ownership / `can_write` authorization remains authoritative.

### Roadmap

- **V0.1**: scan ordinary file links and upload them to the real Rain API;
- **V0.2**: select an existing Issue instead of always creating a new one;
- **V0.3**: detect dynamic downloads and API-driven download buttons;
- **V0.4**: support authenticated downloads from Jira, Jenkins, and internal diagnostic platforms;
- **V0.5**: replace permanent `<all_urls>` access with optional host permissions;
- **V0.6**: generate better Issue Code / Issue Name values from page context.
