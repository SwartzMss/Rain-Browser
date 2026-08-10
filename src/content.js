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

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  const FILE_NAME_PATTERN_SOURCE = `([^\\s<>"'=\\/\\\\]+(?:${RAIN_FILE_EXTENSIONS
    .slice()
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|")}))(?=$|[\\s<>"'&,;:)\\]])`;

  const FILE_NAME_PATTERN = new RegExp(FILE_NAME_PATTERN_SOURCE, "i");

  function extractDiagnosticFileName(text) {
    const match = String(text || "").match(FILE_NAME_PATTERN);
    return match?.[1]?.trim() || "";
  }

  function extractDiagnosticFileNames(text) {
    const names = new Set();
    const pattern = new RegExp(FILE_NAME_PATTERN_SOURCE, "ig");
    for (const match of String(text || "").matchAll(pattern)) {
      const fileName = match?.[1]?.trim();
      if (fileName) {
        names.add(fileName);
      }
    }
    return [...names];
  }

  function hasDiagnosticExtension(value) {
    const target = String(value || "").toLowerCase();
    return RAIN_FILE_EXTENSIONS.some((ext) => target.includes(ext));
  }

  function findDirectFileName(anchor) {
    for (const attribute of ["data-filename", "data-file-name", "data-name"]) {
      const fileName = extractDiagnosticFileName(anchor.getAttribute(attribute));
      if (fileName) {
        return fileName;
      }
    }

    for (const value of [
      anchor.textContent,
      anchor.getAttribute("title"),
      anchor.getAttribute("aria-label")
    ]) {
      const fileName = extractDiagnosticFileName(value);
      if (fileName) {
        return fileName;
      }
    }

    return "";
  }

  function downloadUuid(url) {
    try {
      return new URL(url).searchParams.get("uuid") || "";
    } catch (_) {
      return "";
    }
  }

  function findUuidScopedSiblingFileName(anchor, url) {
    const parent = anchor.parentElement;
    if (!parent) {
      return "";
    }

    const uuid = downloadUuid(url);
    const parentName = (parent.getAttribute("name") || "").trim();

    // This page structure binds one attachment to one direct container:
    // <div name="UUID">
    //   <a onclick="viewAttachment('UUID', this)">real-name.zip - size</a>
    //   <a href="fileStorage/download?uuid=UUID" title="下载">...</a>
    // </div>
    // If both UUIDs are available they must match before sibling text is trusted.
    if (uuid && parentName && uuid !== parentName) {
      return "";
    }

    const candidates = new Set();
    for (const sibling of parent.children) {
      if (sibling === anchor) {
        continue;
      }

      if (uuid && !parentName) {
        const onclick = sibling.getAttribute?.("onclick") || "";
        const siblingName = sibling.getAttribute?.("name") || "";
        if (!onclick.includes(uuid) && siblingName !== uuid) {
          continue;
        }
      }

      for (const fileName of extractDiagnosticFileNames(sibling.textContent)) {
        candidates.add(fileName);
      }

      for (const attribute of ["title", "aria-label", "data-filename", "data-file-name", "data-name"]) {
        const fileName = extractDiagnosticFileName(sibling.getAttribute?.(attribute));
        if (fileName) {
          candidates.add(fileName);
        }
      }
    }

    return candidates.size === 1 ? [...candidates][0] : "";
  }

  function findNearbyFileName(anchor) {
    const tableRow = anchor.closest("tr");
    if (tableRow) {
      const names = extractDiagnosticFileNames(tableRow.textContent);
      if (names.length === 1) {
        return names[0];
      }
      return "";
    }

    const semanticContainer = anchor.closest(
      "li, .file, .file-row, .attachment, .attachment-row, .upload, .upload-row"
    );
    if (semanticContainer) {
      const names = extractDiagnosticFileNames(semanticContainer.textContent);
      if (names.length === 1) {
        return names[0];
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
      const parsed = new URL(url);
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
      const parsed = new URL(url);
      for (const key of ["filename", "fileName", "name"]) {
        const value = parsed.searchParams.get(key);
        if (value) {
          return value.trim();
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

  function pathFileName(url) {
    try {
      const parsed = new URL(url);
      return decodeURIComponent(parsed.pathname.split("/").pop() || "").trim();
    } catch (_) {
      return "";
    }
  }

  function normalizeFileName(url, anchor, explicitDownload) {
    const downloadName = anchor.getAttribute("download");
    if (downloadName) {
      return downloadName.trim();
    }

    const directFileName = findDirectFileName(anchor);
    if (directFileName) {
      return directFileName;
    }

    const pathName = pathFileName(url);
    if (pathName && hasDiagnosticExtension(pathName)) {
      return pathName;
    }

    if (explicitDownload) {
      const siblingFileName = findUuidScopedSiblingFileName(anchor, url);
      if (siblingFileName) {
        return siblingFileName;
      }

      // If this download endpoint does not expose a trustworthy one-to-one
      // sibling filename, retain a unique URL-derived name. The real download
      // response can still replace it via Content-Disposition before upload.
      return provisionalDownloadName(url);
    }

    const nearbyFileName = findNearbyFileName(anchor);
    if (nearbyFileName) {
      return nearbyFileName;
    }

    if (pathName) {
      return pathName;
    }

    const anchorText = anchor.textContent.trim();
    return anchorText || "unknown-file";
  }

  function looksLikeDiagnosticFile(url, fileName) {
    return hasDiagnosticExtension(`${url} ${fileName}`);
  }

  function resolvedAnchorUrl(anchor) {
    // anchor.href is resolved by the browser using document.baseURI, including
    // any <base href="..."> element. This must match what a real click uses.
    const browserResolvedUrl = String(anchor.href || "").trim();
    if (browserResolvedUrl) {
      return browserResolvedUrl;
    }

    const rawHref = anchor.getAttribute("href");
    return new URL(rawHref, document.baseURI).href;
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
        url = resolvedAnchorUrl(anchor);
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
