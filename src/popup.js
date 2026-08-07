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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const response = await chrome.tabs.sendMessage(tab.id, { type: "RAIN_SCAN_PAGE" });
  renderResources(response?.resources || []);
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
    await checkRainLogin();

    const issueCode = generateIssueCode();
    await createIssue(issueCode, `Browser Import ${new Date().toISOString()}`);

    for (let index = 0; index < selected.length; index += 1) {
      setStatus(`正在下载并上传 ${index + 1}/${selected.length}: ${selected[index].fileName}`);
      await uploadBrowserFile(issueCode, selected[index]);
    }

    setStatus(`导入完成: ${issueCode}`);
  } catch (error) {
    setStatus(`导入失败: ${error.message}`);
  }

  importButton.disabled = false;
});

(async function init() {
  serverUrlInput.value = await getRainServerUrl();
  await scanCurrentPage();
})();
