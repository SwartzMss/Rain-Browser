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

async function listRainIssues() {
  const rainServerUrl = await getRainServerUrl();
  const response = await fetch(`${rainServerUrl}/api/issues`, {
    method: "GET",
    credentials: "include"
  });

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new Error(`Load issues failed: HTTP ${response.status}${detail ? ` - ${detail}` : ""}`);
  }

  const issues = await response.json();
  return Array.isArray(issues) ? issues : [];
}

async function listWritableIssues() {
  const issues = await listRainIssues();
  return issues.filter((issue) => issue?.can_write === true);
}

async function getRainIssue(issueCode) {
  const rainServerUrl = await getRainServerUrl();
  const response = await fetch(`${rainServerUrl}/api/issues/${encodeURIComponent(issueCode)}`, {
    method: "GET",
    credentials: "include"
  });

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new Error(`Load issue files failed: HTTP ${response.status}${detail ? ` - ${detail}` : ""}`);
  }

  return response.json();
}

async function listRainIssueUploadedFileNames(issueCode) {
  const issue = await getRainIssue(issueCode);
  const names = new Set();
  const bundles = Array.isArray(issue?.log_bundles) ? issue.log_bundles : [];
  const rainServerUrl = await getRainServerUrl();

  await Promise.all(bundles
    .filter((bundle) => bundle?.hash && bundle?.status?.upload_status === "READY")
    .map(async (bundle) => {
      const response = await fetch(
        `${rainServerUrl}/api/files/v1/${encodeURIComponent(bundle.hash)}/files/root`,
        { method: "GET", credentials: "include" }
      );
      if (!response.ok) {
        const detail = await readErrorDetail(response);
        throw new Error(`Load bundle files failed: HTTP ${response.status}${detail ? ` - ${detail}` : ""}`);
      }
      const tree = await response.json();
      for (const file of (tree?.children || [])) {
        if (file?.meta?.kind === "uploaded_file" && file.name) {
          names.add(String(file.name).trim().toLowerCase());
        }
      }
    }));

  return names;
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

function sanitizeDownloadedFileName(value) {
  const normalized = String(value || "").trim().replace(/^['"]|['"]$/g, "");
  return normalized.split(/[\\/]/).pop()?.trim() || "";
}

function fileNameFromContentDisposition(response) {
  const contentDisposition = response.headers.get("content-disposition") || "";
  if (!contentDisposition) {
    return "";
  }

  const encodedMatch = contentDisposition.match(/filename\*\s*=\s*([^;]+)/i);
  if (encodedMatch) {
    let encoded = encodedMatch[1].trim().replace(/^['"]|['"]$/g, "");
    encoded = encoded.replace(/^UTF-8''/i, "");
    try {
      return sanitizeDownloadedFileName(decodeURIComponent(encoded));
    } catch (_) {
      return sanitizeDownloadedFileName(encoded);
    }
  }

  const plainMatch = contentDisposition.match(/filename\s*=\s*(?:"([^"]+)"|([^;]+))/i);
  return sanitizeDownloadedFileName(plainMatch?.[1] || plainMatch?.[2] || "");
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
  const responseFileName = fileNameFromContentDisposition(response);
  const fileName = responseFileName || resource.fileName || "download";
  return new File([blob], fileName, {
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
