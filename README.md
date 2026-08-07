# Rain-Browser

Chrome/Edge extension for importing web-hosted logs and diagnostic files directly into Rain without manually downloading and re-uploading them.

## Current MVP

Rain-Browser currently supports:

- scanning the current page for ordinary `<a href>` download links;
- detecting common diagnostic/log/archive files such as `.log`, `.txt`, `.zip`, `.tar.gz`, `.tgz`, `.gz`, `.7z`, `.json`, `.trace`, `.dmp` and `.dump`;
- selecting one or more discovered resources;
- reusing the user's existing Rain session cookie;
- creating a Rain Issue automatically;
- downloading the selected resource from the browser context;
- uploading it to the real Rain upload API.

## Import flow

```text
External log page
      |
      | scan links
      v
Rain-Browser
      |
      | GET /api/auth/me
      v
Existing Rain login session
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

The extension does not store a Rain username or password. Requests use the existing `rain_session` HttpOnly cookie through `credentials: "include"`.

## Rain compatibility

Rain protects unsafe API requests with same-origin middleware. Rain-Browser marks its write requests with:

```http
X-Rain-Browser: 1
Origin: chrome-extension://<extension-id>
```

Rain only accepts this extension path when the request Origin is a syntactically valid Chrome extension origin. Ordinary cross-origin web requests remain rejected.

No generic CORS enablement is required. The extension uses Chrome host permissions for cross-origin requests.

## Install locally

1. Clone this repository.
2. Open `chrome://extensions` in Chrome or Edge.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the repository directory.
6. Open Rain in the same browser and log in.
7. Open the Rain-Browser popup and configure the Rain server URL if it is not `http://127.0.0.1:8080`.
8. Visit a page containing log/download links and click **导入 Rain**.

## Rain APIs used

### Check authentication

```http
GET /api/auth/me
```

Expected authenticated response shape:

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

Guests receive HTTP 200 with `authenticated: false`; Rain-Browser treats that as not logged in.

### Create Issue

```http
POST /api/issues
Content-Type: application/json
X-Rain-Browser: 1
```

```json
{
  "code": "RAIN-1754568620000",
  "name": "Browser Import 2026-08-07T12:34:56.000Z"
}
```

### Upload file

```http
POST /api/issues/{issue_code}/uploads
Content-Type: multipart/form-data
X-Rain-Browser: 1
```

The file is sent in the `file` multipart field and then follows Rain's normal background extraction/indexing pipeline.

## Security notes

- Rain credentials are never stored by the extension.
- Rain's existing HttpOnly session cookie remains authoritative.
- Guest users still cannot create Issues or upload files.
- The normal Rain same-origin protection remains enabled.
- The current MVP requests broad host permission because it must discover and fetch logs from arbitrary internal sites. This should be reduced or moved to optional host permissions before publishing publicly.

## Roadmap

- V0.1: scan ordinary page links and upload them to the real Rain API.
- V0.2: allow choosing an existing Issue instead of always creating a new one.
- V0.3: detect dynamically generated download resources and API-backed download buttons.
- V0.4: improve authenticated source downloads for Jira, Jenkins and internal diagnostic platforms.
- V0.5: use optional host permissions instead of permanent `<all_urls>` access where practical.
