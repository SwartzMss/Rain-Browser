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

function normalizeFileName(url, anchor) {
  const downloadName = anchor.getAttribute("download");
  if (downloadName) {
    return downloadName.trim();
  }

  try {
    const parsed = new URL(url, window.location.href);
    const pathName = decodeURIComponent(parsed.pathname.split("/").pop() || "");
    if (pathName) {
      return pathName;
    }
  } catch (_) {
    // Ignore malformed URLs and fall back to anchor text.
  }

  return anchor.textContent.trim() || "unknown-file";
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

    const fileName = normalizeFileName(url, anchor);
    if (!looksLikeDiagnosticFile(url, fileName) || seen.has(url)) {
      return;
    }

    seen.add(url);
    resources.push({
      url,
      fileName,
      text: anchor.textContent.trim(),
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
