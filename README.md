# Rain-Browser

Browser extension for importing web-hosted logs and diagnostic files directly into Rain.

## MVP goals

- Scan the current page for downloadable diagnostic files.
- Detect common log/archive types such as `.log`, `.txt`, `.zip`, `.tar.gz`, `.tgz`, `.gz`, `.7z`, `.json` and `.trace`.
- Let users select one or more discovered files.
- Import selected resources into Rain with one click.
- Keep Rain server address configurable in the extension.

## Current import model

The first version sends discovered resource URLs to Rain:

```text
Browser page
   -> Rain-Browser extension
   -> POST /api/import/url
   -> Rain
```

The extension contract is intentionally isolated in `src/rain-api.js` so it can later be switched to browser-side download + upload for authenticated resources.

## Install locally

1. Clone this repository.
2. Open `chrome://extensions` in Chrome or Edge.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the repository directory.
6. Open the Rain-Browser popup and configure the Rain server URL.

## Expected Rain API

```http
POST /api/import/url
Content-Type: application/json
```

Example request:

```json
{
  "url": "https://example.com/logs/crash.log",
  "filename": "crash.log",
  "source": "rain-browser",
  "pageUrl": "https://example.com/issue/123",
  "pageTitle": "Issue 123"
}
```

The API endpoint is a temporary MVP contract and can be adjusted to match Rain's actual backend.

## Roadmap

- V0.1: scan ordinary page links and import by URL.
- V0.2: detect dynamically generated download resources.
- V0.3: support authenticated browser-side fetch and direct upload to Rain.
- V0.4: add adapters for Jira, Jenkins and internal diagnostic platforms.
