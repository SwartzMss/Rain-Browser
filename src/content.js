(() => {
  if (globalThis.__rainBrowserContentInitialized) {
    return;
  }
  globalThis.__rainBrowserContentInitialized = true;

  const RAIN_FILE_EXTENSIONS = [
    ".log",
    ".txt",
    ".zip",
    ".tar.gz",
    ".tgz",
    ".gz",
    ".7z",
    ".json",
    ".trace",
    ".dmp",
    ".dump"
  ];

  const FILE_NAME_PATTERN = new RegExp(
    `([^\\s<>"'=\\/\\\\]+(?:${RAIN_FILE_EXTENSIONS
      .slice()
      .sort((left, right) => right.length - left.length)
      .map((ext) => ext.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"))
      .join("|")}))(?=$|[\\s<>"'&,;:)\\]])`,
    "i"
  );

  function extractDiagnosticFileName(text) {
    const match = String(text || "").match(FILE_NAME_PATTERN);
    return match?.[1]?.trim() || "";
  }

  function findNearbyFileName(anchor) {
    for (const attribute of ["data-filename", "data-file-name", "data-name"]) {
      const value = anchor.getAttribute(attribute);
      const fileName = extractDiagnosticFileName(value);
      if (fileName) {
        return fileName;
      }
    }

    const semanticContainer = anchor.closest(
      "tr, li, .file, .file-row, .attachment, .attachment-row, .upload, .upload-row"
    );
    const semanticFileName = extractDiagnosticFileName(semanticContainer?.textContent);
    if (semanticFileName) {
      return semanticFileName;
    }

    let parent = anchor.parentElement;
    for (let depth = 0; parent && depth < 3; depth += 1, parent = parent.parentElement) {
      const fileName = extractDiagnosticFileName(parent.textContent);
      if (fileName) {
        return fileName;
      }
    }

    return "";
  }

  function isExplicitDownloadAnchor(anchor, url) {
    if (anchor.hasAttribute("download")) {
      return true;
    }

    const title = (anchor.getAttribute("title") || "").trim().toLowerCase();
    const ariaLabel = (anchor.getAttribute("aria-label") || "").trim().toLowerCase();
    const className = String(anchor.className || "").toLowerCase();
    const hasDownloadIcon = Boolean(
      anchor.querySelector('[class*="download"], [class*="glyphicon-download"]')
    );

    let pathLooksLikeDownload = false;
    try {
      const parsed = new URL(url, window.location.href);
      pathLooksLikeDownload = /(^|\/)download(?:\/|$)/i.test(parsed.pathname);
    } catch (_) {
      // Ignore malformed URLs; other download signals may still identify the link.
    }

    return title.includes("下载")
      || title.includes("download")
      || ariaLabel.includes("下载")
      || ariaLabel.includes("download")
      || className.includes("download")
      || hasDownloadIcon
      || pathLooksLikeDownload;
  }

  function provisionalDownloadName(url) {
    try {
      const parsed = new URL(url, window.location.href);
      for (const key of ["filename", "fileName", "name"]) {
        const value = parsed.searchParams.get(key);
        if (value) {
          return decodeURIComponent(value).trim();
        }
      }

      const uuid = parsed.searchParams.get("uuid");
      if (uuid) {
        return `download-${uuid}`;
      }
    } catch (_) {
      // Fall through to a generic name.
    }

    return "download";
  }

  function normalizeFileName(url, anchor, explicitDownload) {
    const downloadName = anchor.getAttribute("download");
    if (downloadName) {
      return downloadName.trim();
    }

    const nearbyFileName = findNearbyFileName(anchor);
    if (nearbyFileName) {
      return nearbyFileName;
    }

    try {
      const parsed = new URL(url, window.location.href);
      const pathName = decodeURIComponent(parsed.pathname.split("/").pop() || "");
      if (pathName && (!explicitDownload || pathName.toLowerCase() !== "download")) {
        return pathName;
      }
    } catch (_) {
      // Ignore malformed URLs and fall back to anchor text.
    }

    const anchorText = anchor.textContent.trim();
    if (anchorText) {
      return anchorText;
    }

    return explicitDownload ? provisionalDownloadName(url) : "unknown-file";
  }

  function looksLikeDiagnosticFile(url, fileName) {
    const target = `${url} ${fileName}`.toLowerCase();
    return RAIN_FILE_EXTENSIONS.some((ext) => target.includes(ext));
  }

  function scanPage() {
    const seen = new Set();
    const resources = [];

    document.querySelectorAll("a[href]").forEach((anchor) => {
      const rawHref = anchor.getAttribute("href");
      if (!rawHref || rawHref.startsWith("javascript:") || rawHref.startsWith("#")) {
        return;
      }

      let url;
      try {
        url = new URL(rawHref, window.location.href).href;
      } catch (_) {
        return;
      }

      const explicitDownload = isExplicitDownloadAnchor(anchor, url);
      const fileName = normalizeFileName(url, anchor, explicitDownload);
      if ((!looksLikeDiagnosticFile(url, fileName) && !explicitDownload) || seen.has(url)) {
        return;
      }

      seen.add(url);
      resources.push({
        url,
        fileName,
        text: anchor.textContent.trim(),
        sourceType: explicitDownload ? "download-link" : "file-link",
        pageUrl: window.location.href,
        pageTitle: document.title
      });
    });

    return resources;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "RAIN_SCAN_PAGE") {
      sendResponse({ resources: scanPage() });
    }
  });
})();
