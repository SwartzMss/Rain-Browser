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

async function importBrowserFile(resource) {
  const rainServerUrl = await getRainServerUrl();

  const fileResponse = await fetch(resource.url, {
    credentials: "include"
  });

  if (!fileResponse.ok) {
    throw new Error(`Browser download failed: HTTP ${fileResponse.status}`);
  }

  const blob = await fileResponse.blob();
  const file = new File([blob], resource.fileName, {
    type: blob.type || "application/octet-stream"
  });

  const form = new FormData();
  form.append("file", file);
  form.append("source", "rain-browser");
  form.append("pageUrl", resource.pageUrl || "");
  form.append("pageTitle", resource.pageTitle || "");

  const response = await fetch(`${rainServerUrl}/api/upload`, {
    method: "POST",
    credentials: "include",
    body: form
  });

  if (!response.ok) {
    throw new Error(`Rain upload failed: HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json") ? response.json() : { ok: true };
}
