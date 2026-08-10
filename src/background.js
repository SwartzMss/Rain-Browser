importScripts("rain-api.js");

const IMPORT_JOB_KEY = "rainImportJob";
const LOGS_KEY = "rainBackgroundLogs";
const MAX_LOGS = 500;

chrome.runtime.onInstalled.addListener(() => {
  console.info("Rain Browser installed");
});

async function saveImportJob(job) {
  await chrome.storage.local.set({ [IMPORT_JOB_KEY]: job });
}

async function recordLog(level, event, message, details = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
    level,
    event,
    message,
    ...details
  };
  const stored = await chrome.storage.local.get({ [LOGS_KEY]: [] });
  const logs = Array.isArray(stored[LOGS_KEY]) ? stored[LOGS_KEY] : [];
  await chrome.storage.local.set({ [LOGS_KEY]: [entry, ...logs].slice(0, MAX_LOGS) });
}

async function runImportJob(job) {
  try {
    await recordLog("info", "job_started", "后台导入任务已启动", {
      issueCode: job.issueCode,
      total: job.resources.length
    });
    await saveImportJob({ ...job, status: "running", completed: 0 });

    for (let index = 0; index < job.resources.length; index += 1) {
      const resource = job.resources[index];
      const commonDetails = {
        issueCode: job.issueCode,
        index: index + 1,
        total: job.resources.length,
        fileName: resource.fileName || "",
        sourceUrl: resource.url || "",
        rawHref: resource.rawHref || "",
        baseUri: resource.baseUri || "",
        uuid: resource.uuid || "",
        parentName: resource.parentName || "",
        sourceType: resource.sourceType || "",
        pageUrl: resource.pageUrl || ""
      };

      await saveImportJob({
        ...job,
        status: "running",
        completed: index,
        currentFileName: resource.fileName
      });
      await recordLog("info", "upload_started", `开始处理 ${resource.fileName}`, commonDetails);

      const transferLogger = async (level, event, message, details = {}) => {
        await recordLog(level, event, message, {
          issueCode: job.issueCode,
          index: index + 1,
          total: job.resources.length,
          ...details
        });
      };

      await uploadBrowserFile(job.issueCode, resource, transferLogger);
      await recordLog("info", "upload_completed", `上传完成 ${resource.fileName}`, commonDetails);
      await saveImportJob({
        ...job,
        status: "running",
        completed: index + 1,
        currentFileName: resource.fileName
      });
    }

    await saveImportJob({
      ...job,
      status: "completed",
      completed: job.resources.length,
      currentFileName: ""
    });
    await recordLog("info", "job_completed", "后台导入任务已完成", {
      issueCode: job.issueCode,
      total: job.resources.length
    });
  } catch (error) {
    const failedResource = job.resources[job.completed] || {};
    await saveImportJob({
      ...job,
      status: "failed",
      error: error.message || String(error)
    });
    await recordLog("error", "job_failed", error.message || String(error), {
      issueCode: job.issueCode,
      fileName: failedResource.fileName || "",
      sourceUrl: failedResource.url || "",
      rawHref: failedResource.rawHref || "",
      baseUri: failedResource.baseUri || "",
      uuid: failedResource.uuid || "",
      parentName: failedResource.parentName || "",
      sourceType: failedResource.sourceType || "",
      pageUrl: failedResource.pageUrl || ""
    });
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "RAIN_START_IMPORT") {
    if (message?.type === "RAIN_GET_LOGS") {
      chrome.storage.local.get({ [LOGS_KEY]: [] }).then((stored) => {
        sendResponse({ ok: true, logs: stored[LOGS_KEY] });
      });
      return true;
    }
    if (message?.type === "RAIN_CLEAR_LOGS") {
      chrome.storage.local.set({ [LOGS_KEY]: [] }).then(() => {
        sendResponse({ ok: true });
      });
      return true;
    }
    return false;
  }

  (async () => {
    const stored = await chrome.storage.local.get(IMPORT_JOB_KEY);
    if (stored[IMPORT_JOB_KEY]?.status === "running") {
      sendResponse({ ok: false, error: "已有一个后台导入任务正在进行" });
      return;
    }

    const job = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      status: "queued",
      issueCode: message.issueCode,
      resources: message.resources || [],
      completed: 0,
      total: (message.resources || []).length,
      currentFileName: "",
      error: ""
    };
    await saveImportJob(job);
    sendResponse({ ok: true, jobId: job.id });
    void runImportJob(job);
  })().catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));

  return true;
});
