const logsEl = document.getElementById("logs");
const summaryEl = document.getElementById("summary");
const selectAllButton = document.getElementById("selectAll");
const downloadButton = document.getElementById("download");
const clearButton = document.getElementById("clear");
let logs = [];

function formatTime(value) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function selectedLogs() {
  return [...logsEl.querySelectorAll("input[type=checkbox]:checked")]
    .map((checkbox) => logs.find((log) => log.id === checkbox.dataset.id))
    .filter(Boolean);
}

function updateActions() {
  const selected = selectedLogs().length;
  downloadButton.disabled = selected === 0;
  summaryEl.textContent = `${logs.length} 条日志，已选择 ${selected} 条`;
}

function renderLogs() {
  logsEl.innerHTML = "";
  if (!logs.length) {
    logsEl.innerHTML = '<div class="empty">暂无后台日志</div>';
    updateActions();
    return;
  }

  logs.forEach((log) => {
    const row = document.createElement("label");
    row.className = "log-row";
    row.innerHTML = `<input type="checkbox" data-id="${log.id}"><span class="log-time">${formatTime(log.timestamp)}</span><span class="level ${log.level}">${log.level}</span><span class="log-message"></span>`;
    const message = row.querySelector(".log-message");
    message.textContent = log.message;
    const details = Object.entries(log)
      .filter(([key]) => !["id", "timestamp", "level", "event", "message"].includes(key))
      .map(([key, value]) => `${key}=${value}`)
      .join(" · ");
    if (details) {
      const detailEl = document.createElement("div");
      detailEl.className = "log-details";
      detailEl.textContent = details;
      message.appendChild(detailEl);
    }
    logsEl.appendChild(row);
  });
  logsEl.addEventListener("change", updateActions);
  updateActions();
}

selectAllButton.addEventListener("click", () => {
  const checkboxes = [...logsEl.querySelectorAll("input[type=checkbox]")];
  const shouldSelect = checkboxes.some((checkbox) => !checkbox.checked);
  checkboxes.forEach((checkbox) => { checkbox.checked = shouldSelect; });
  updateActions();
});

downloadButton.addEventListener("click", () => {
  const selected = selectedLogs();
  if (!selected.length) return;
  const blob = new Blob([JSON.stringify(selected, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `rain-browser-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

clearButton.addEventListener("click", async () => {
  if (!logs.length || !confirm("确定清空全部后台日志吗？")) return;
  await chrome.runtime.sendMessage({ type: "RAIN_CLEAR_LOGS" });
  logs = [];
  renderLogs();
});

(async function init() {
  const response = await chrome.runtime.sendMessage({ type: "RAIN_GET_LOGS" });
  logs = response?.logs || [];
  renderLogs();
})();
