const DEFAULT_RAIN_URL = "http://127.0.0.1:8080";
const RAIN_BROWSER_HEADER = "X-Rain-Browser";

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

async function readErrorDetail(response) {
  try {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await response.json();
      return body?.message || body?.code || JSON.stringify(body);
    }
    return await response.text();
  } catch (_) {
    return "";
  }
}

async function checkRainLogin() {
  const rainServerUrl = await getRainServerUrl();
  const response = await fetch(`${rainServerUrl}/api/auth/me`, {
    method: "GET",
    credentials: "include"
  });

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new Error(`Rain login check failed: HTTP ${response.status}${detail ? ` - ${detail}` : ""}`);
  }

  const session = await response.json();
  if (!session?.authenticated || !session?.user) {
    throw new Error("请先登录 Rain");
  }

  return session.user;
}

async function createIssue(issueCode, issueName) {
  const rainServerUrl = await getRainServerUrl();
  const response = await fetch(`${rainServerUrl}/api/issues`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      [RAIN_BROWSER_HEADER]: "1"
    },
    body: JSON.stringify({
      code: issueCode,
      name: issueName
    })
  });

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new Error(`Create issue failed: HTTP ${response.status}${detail ? ` - ${detail}` : ""}`);
  }

  return response.json();
}

async function downloadBrowserResource(resource) {
  const response = await fetch(resource.url, {
    method: "GET",
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error(`Browser download failed: HTTP ${response.status}`);
  }

  const blob = await response.blob();
  return new File([blob], resource.fileName, {
    type: blob.type || "application/octet-stream"
  });
}

async function uploadBrowserFile(issueCode, resource) {
  const rainServerUrl = await getRainServerUrl();
  const file = await downloadBrowserResource(resource);
  const form = new FormData();
  form.append("files", file);

  const response = await fetch(
    `${rainServerUrl}/api/issues/${encodeURIComponent(issueCode)}/uploads`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        [RAIN_BROWSER_HEADER]: "1"
      },
      body: form
    }
  );

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new Error(`Upload failed: HTTP ${response.status}${detail ? ` - ${detail}` : ""}`);
  }

  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json") ? response.json() : { ok: true };
}
