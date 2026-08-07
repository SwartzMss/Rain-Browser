let currentResources = [];
let writableIssues = [];
let allIssues = [];

const statusEl = document.getElementById("status");
const resourcesEl = document.getElementById("resources");
const importButton = document.getElementById("importButton");
const serverUrlInput = document.getElementById("serverUrl");
const saveServerButton = document.getElementById("saveServer");
const issueSelect = document.getElementById("issueSelect");
const issueHint = document.getElementById("issueHint");
const newIssueFields = document.getElementById("newIssueFields");
const newIssueCodeInput = document.getElementById("newIssueCode");
const newIssueNameInput = document.getElementById("newIssueName");

function setStatus(message) {
  statusEl.textContent = message;
}

function renderResources(resources) {
  currentResources = resources;
  resourcesEl.innerHTML = "";

  if (!resources.length) {
    resourcesEl.innerHTML = '<div class="empty">当前页面没有发现可导入的日志资源</div>';
    importButton.disabled = true;
    return;
  }

  resources.forEach((resource, index) => {
    const row = document.createElement("label");
    row.className = "resource";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.dataset.index = String(index);

    const content = document.createElement("div");
    const name = document.createElement("div");
    name.className = "resource-name";
    name.textContent = resource.fileName;

    const url = document.createElement("div");
    url.className = "resource-url";
    url.textContent = resource.url;

    content.appendChild(name);
    content.appendChild(url);
    row.appendChild(checkbox);
    row.appendChild(content);
    resourcesEl.appendChild(row);
  });

  importButton.disabled = false;
}

function getSelectedResources() {
  return [...resourcesEl.querySelectorAll('input[type="checkbox"]:checked')]
    .map((checkbox) => currentResources[Number(checkbox.dataset.index)])
    .filter(Boolean);
}

function generateFallbackIssueCode() {
  return `RAIN-${Date.now()}`;
}

function inferIssueCode() {
  const first = currentResources[0];
  if (!first) {
    return null;
  }

  const candidates = [first.pageTitle, first.pageUrl, first.text]
    .filter(Boolean)
    .join(" ");
  const match = candidates.match(/\b([A-Za-z][A-Za-z0-9]{1,15}-\d{1,10})\b/);
  return match ? match[1].toUpperCase() : null;
}

function inferIssueName() {
  const title = currentResources[0]?.pageTitle?.trim();
  if (title) {
    return title.slice(0, 128);
  }
  return `Browser Import ${new Date().toISOString()}`;
}

function validateIssueCode(code) {
  return /^[A-Za-z0-9._-]{1,64}$/.test(code);
}

function prefillNewIssue(force = false) {
  const inferredCode = inferIssueCode();
  const inferredExists = inferredCode
    ? allIssues.some((issue) => String(issue.code).toUpperCase() === inferredCode)
    : false;

  if (force || !newIssueCodeInput.value.trim()) {
    newIssueCodeInput.value = inferredCode && !inferredExists
      ? inferredCode
      : generateFallbackIssueCode();
  }

  if (force || !newIssueNameInput.value.trim()) {
    newIssueNameInput.value = inferIssueName();
  }
}

function updateIssueMode() {
  const creating = issueSelect.value === "__new__";
  newIssueFields.classList.toggle("hidden", !creating);
  if (creating) {
    prefillNewIssue(false);
  }
}

function renderIssueOptions() {
  const previousValue = issueSelect.value;
  issueSelect.innerHTML = '<option value="__new__">新建 Issue</option>';

  writableIssues.forEach((issue) => {
    const option = document.createElement("option");
    option.value = issue.code;
    option.textContent = issue.name ? `${issue.code} — ${issue.name}` : issue.code;
    issueSelect.appendChild(option);
  });

  const inferredCode = inferIssueCode();
  const inferredWritable = inferredCode
    ? writableIssues.find((issue) => String(issue.code).toUpperCase() === inferredCode)
    : null;
  const inferredAny = inferredCode
    ? allIssues.find((issue) => String(issue.code).toUpperCase() === inferredCode)
    : null;

  if (inferredWritable) {
    issueSelect.value = inferredWritable.code;
    issueHint.textContent = `已根据当前页面匹配到你的 Issue：${inferredWritable.code}`;
  } else if (previousValue && [...issueSelect.options].some((option) => option.value === previousValue)) {
    issueSelect.value = previousValue;
    issueHint.textContent = `仅显示当前用户拥有上传权限的 ${writableIssues.length} 个 Issue。`;
  } else {
    issueSelect.value = "__new__";
    prefillNewIssue(true);
    if (inferredAny && inferredAny.can_write !== true) {
      issueHint.textContent = `页面识别到 ${inferredCode}，但当前用户没有写权限，将新建 Issue。`;
    } else if (inferredCode) {
      issueHint.textContent = `页面识别到 ${inferredCode}，未找到可写的同名 Issue，将新建 Issue。`;
    } else {
      issueHint.textContent = `可选择当前用户拥有的 ${writableIssues.length} 个 Issue，或新建 Issue。`;
    }
  }

  updateIssueMode();
}

async function refreshIssueTargets() {
  try {
    await checkRainLogin();
    allIssues = await listRainIssues();
    writableIssues = allIssues.filter((issue) => issue?.can_write === true);
    renderIssueOptions();
  } catch (error) {
    allIssues = [];
    writableIssues = [];
    issueSelect.innerHTML = '<option value="__new__">新建 Issue</option>';
    issueSelect.value = "__new__";
    prefillNewIssue(true);
    updateIssueMode();
    issueHint.textContent = error.message === "请先登录 Rain"
      ? "登录 Rain 后可选择你拥有的已有 Issue。"
      : `无法加载 Issue：${error.message}`;
  }
}

function isRestrictedPageUrl(url) {
  return /^(chrome|edge|about|devtools|chrome-extension|view-source):/i.test(url || "");
}

async function requestPageScan(tabId) {
  return chrome.tabs.sendMessage(tabId, { type: "RAIN_SCAN_PAGE" });
}

async function requestPageScanWithInjection(tab) {
  try {
    return await requestPageScan(tab.id);
  } catch (error) {
    const message = String(error?.message || error || "");
    const missingReceiver = message.includes("Receiving end does not exist")
      || message.includes("Could not establish connection");

    if (!missingReceiver) {
      throw error;
    }

    if (isRestrictedPageUrl(tab.url)) {
      throw new Error("当前是浏览器内部页面，Chrome/Edge 不允许扩展扫描此页面");
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["src/content.js"]
      });
    } catch (injectError) {
      const injectMessage = String(injectError?.message || injectError || "");
      if (String(tab.url || "").startsWith("file://")) {
        throw new Error("无法扫描本地文件页面，请在扩展详情中开启“允许访问文件网址”");
      }
      throw new Error(`当前页面不允许扩展注入扫描脚本: ${injectMessage}`);
    }

    return requestPageScan(tab.id);
  }
}

async function scanCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error("无法获取当前页面");
    }

    const response = await requestPageScanWithInjection(tab);
    const resources = response?.resources || [];
    renderResources(resources);
    setStatus(`发现 ${resources.length} 个可导入资源`);
  } catch (error) {
    renderResources([]);
    setStatus(`扫描失败: ${error.message}`);
  }
}

async function requireRainLogin() {
  try {
    return await checkRainLogin();
  } catch (error) {
    if (error.message === "请先登录 Rain") {
      const rainServerUrl = await getRainServerUrl();
      await chrome.tabs.create({ url: rainServerUrl, active: true });
      throw new Error("请先登录 Rain，已为你打开 Rain 页面");
    }
    throw error;
  }
}

async function resolveTargetIssue() {
  if (issueSelect.value === "__new__") {
    const issueCode = newIssueCodeInput.value.trim().toUpperCase();
    const issueName = newIssueNameInput.value.trim();

    if (!validateIssueCode(issueCode)) {
      throw new Error("Issue Code 只能包含字母、数字、'.'、'_'、'-'，长度 1-64");
    }
    if (!issueName || issueName.length > 128) {
      throw new Error("Issue Name 长度必须为 1-128");
    }

    setStatus(`正在创建 ${issueCode}`);
    await createIssue(issueCode, issueName);
    return issueCode;
  }

  const latestWritable = await listWritableIssues();
  const selectedIssue = latestWritable.find((issue) => issue.code === issueSelect.value);
  if (!selectedIssue) {
    throw new Error("该 Issue 已不属于当前用户或当前用户已无上传权限，请刷新后重试");
  }

  return selectedIssue.code;
}

issueSelect.addEventListener("change", () => {
  updateIssueMode();
  if (issueSelect.value === "__new__") {
    issueHint.textContent = "将创建新的 Rain Issue 后上传文件。";
  } else {
    issueHint.textContent = `将上传到你的 Issue：${issueSelect.value}`;
  }
});

saveServerButton.addEventListener("click", async () => {
  try {
    const savedUrl = await setRainServerUrl(serverUrlInput.value);
    serverUrlInput.value = savedUrl;
    setStatus("Rain 地址已保存");
    await refreshIssueTargets();
  } catch (error) {
    setStatus(error.message);
  }
});

importButton.addEventListener("click", async () => {
  const selected = getSelectedResources();
  if (!selected.length) {
    setStatus("请至少选择一个资源");
    return;
  }

  importButton.disabled = true;

  try {
    const user = await requireRainLogin();
    const issueCode = await resolveTargetIssue();
    setStatus(`已登录 ${user.username}，目标 Issue：${issueCode}`);

    for (let index = 0; index < selected.length; index += 1) {
      setStatus(`正在下载并上传 ${index + 1}/${selected.length}: ${selected[index].fileName}`);
      await uploadBrowserFile(issueCode, selected[index]);
    }

    setStatus(`导入完成: ${issueCode}`);
    await refreshIssueTargets();
  } catch (error) {
    setStatus(`导入失败: ${error.message}`);
  } finally {
    importButton.disabled = false;
  }
});

(async function init() {
  serverUrlInput.value = await getRainServerUrl();
  await scanCurrentPage();
  await refreshIssueTargets();
})();
