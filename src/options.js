const serverUrlInput = document.getElementById("serverUrl");
const statusEl = document.getElementById("status");
const saveButton = document.getElementById("save");
const testButton = document.getElementById("test");
const openLogsButton = document.getElementById("openLogs");

function setStatus(message) { statusEl.textContent = message; }

async function saveSettings() {
  const savedUrl = await setRainServerUrl(serverUrlInput.value);
  serverUrlInput.value = savedUrl;
  setStatus("设置已保存");
  return savedUrl;
}

saveButton.addEventListener("click", async () => {
  try { await saveSettings(); } catch (error) { setStatus(error.message); }
});

testButton.addEventListener("click", async () => {
  try {
    await saveSettings();
    const user = await checkRainLogin();
    setStatus(`连接成功，当前用户：${user.username}`);
  } catch (error) { setStatus(`连接失败：${error.message}`); }
});

openLogsButton.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("src/logs.html") });
});

(async function init() {
  serverUrlInput.value = await getRainServerUrl();
})();
