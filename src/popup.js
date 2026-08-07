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

async function scanCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error("Unable to resolve active tab");
    }

    const response = await chrome.tabs.sendMessage(tab.id, { type: "RAIN_SCAN_PAGE" });
    const resources = response?.resources || [];
    renderResources(resources);
    setStatus(`发现 ${resources.length} 个可导入资源`);
  } catch (error) {
    renderResources([]);
    setStatus(`扫描失败：${error.message}`);
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
  let succeeded = 0;

  for (let index = 0; index < selected.length; index += 1) {
    const resource = selected[index];
    setStatus(`正在导入 ${index + 1}/${selected.length}: ${resource.fileName}`);

    try {
      await importUrlToRain(resource);
      succeeded += 1;
    } catch (error) {
      setStatus(`导入失败：${resource.fileName} - ${error.message}`);
      importButton.disabled = false;
      return;
    }
  }

  setStatus(`导入完成：${succeeded}/${selected.length}`);
  importButton.disabled = false;
});

(async function init() {
  serverUrlInput.value = await getRainServerUrl();
  await scanCurrentPage();
})();
