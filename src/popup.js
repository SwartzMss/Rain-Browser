let currentResources = [];

const statusEl = document.getElementById("status");
const resourcesEl = document.getElementById("resources");
const importButton = document.getElementById("importButton");
const serverUrlInput = document.getElementById("serverUrl");
const saveServerButton = document.getElementById("saveServer");

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

function generateIssueCode() {
  return `RAIN-${Date.now()}`;
}

async function scanCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error("无法获取当前页面");
    }

    const response = await chrome.tabs.sendMessage(tab.id, { type: "RAIN_SCAN_PAGE" });
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

saveServerButton.addEventListener("click", async () => {
  try {
    const savedUrl = await setRainServerUrl(serverUrlInput.value);
    serverUrlInput.value = savedUrl;
    setStatus("Rain 地址已保存");
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
    const issueCode = generateIssueCode();
    setStatus(`已登录 ${user.username}，正在创建 ${issueCode}`);
    await createIssue(issueCode, `Browser Import ${new Date().toISOString()}`);

    for (let index = 0; index < selected.length; index += 1) {
      setStatus(`正在下载并上传 ${index + 1}/${selected.length}: ${selected[index].fileName}`);
      await uploadBrowserFile(issueCode, selected[index]);
    }

    setStatus(`导入完成: ${issueCode}`);
  } catch (error) {
    setStatus(`导入失败: ${error.message}`);
  } finally {
    importButton.disabled = false;
  }
});

(async function init() {
  serverUrlInput.value = await getRainServerUrl();
  await scanCurrentPage();
})();
