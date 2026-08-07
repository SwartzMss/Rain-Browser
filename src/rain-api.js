const DEFAULT_RAIN_URL = "http://127.0.0.1:8000";

async function getRainServerUrl() {
  const result = await chrome.storage.sync.get({ rainServerUrl: DEFAULT_RAIN_URL });
  return String(result.rainServerUrl || DEFAULT_RAIN_URL).replace(/\/$/, "");
}

async function setRainServerUrl(url) {
  const normalized = String(url || "").trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(normalized)) {
    throw new Error("Rain server URL must start with http:// or https://");
  }

  await chrome.storage.sync.set({ rainServerUrl: normalized });
  return normalized;
}

async function checkRainLogin() {
  const rainServerUrl = await getRainServerUrl();

  const response = await fetch(`${rainServerUrl}/api/me`, {
    method: "GET",
    credentials: "include"
  });

  if (response.status === 401) {
    throw new Error("请先登录 Rain");
  }

  if (!response.ok) {
    throw new Error(`Rain login check failed: HTTP ${response.status}`);
  }

  return response.json();
}

async function importUrlToRain(resource) {
  const rainServerUrl = await getRainServerUrl();

  const response = await fetch(`${rainServerUrl}/api/import/browser`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url: resource.url,
      filename: resource.fileName,
      source: "rain-browser",
      pageUrl: resource.pageUrl,
      pageTitle: resource.pageTitle
    })
  });

  if (!response.ok) {
    let detail = "";
    try {
      detail = await response.text();
    } catch (_) {
    }
    throw new Error(`Rain import failed: HTTP ${response.status}${detail ? ` - ${detail}` : ""}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return { ok: true };
}
