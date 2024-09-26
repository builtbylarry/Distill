let tabsWithContentScript = new Set();

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    chrome.tabs.sendMessage(tabId, { action: "ping" }, (response) => {
      if (chrome.runtime.lastError) {
        tabsWithContentScript.delete(tabId);
      } else {
        tabsWithContentScript.add(tabId);
      }
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabsWithContentScript.delete(tabId);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "startInspection":
      handleStartInspection();
      break;
    case "cancelInspection":
      handleCancelInspection();
      break;
    case "elementRemoved":
      handleElementRemoved(request, sender);
      break;
  }
});

function handleStartInspection() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs[0] && tabsWithContentScript.has(tabs[0].id)) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "startInspection" });
    } else {
      console.error("Content script not ready in the current tab");
      chrome.runtime.sendMessage({ action: "contentScriptNotReady" });
    }
  });
}

function handleCancelInspection() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs[0] && tabsWithContentScript.has(tabs[0].id)) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "cancelInspection" });
    }
  });
}

function handleElementRemoved(request, sender) {
  chrome.runtime.sendMessage(request);

  chrome.storage.local.get({ removedElements: {} }, function (result) {
    let removedElements = result.removedElements;
    if (!removedElements[sender.tab.url]) {
      removedElements[sender.tab.url] = [];
    }
    removedElements[sender.tab.url].push(request.data);
    chrome.storage.local.set({ removedElements: removedElements });
  });
}

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  chrome.storage.local.get({ blockedWebsites: [] }, function (result) {
    let blockedWebsites = result.blockedWebsites;
    let url;
    try {
      url = new URL(details.url);
    } catch (e) {
      console.error("Invalid URL:", details.url);
      return;
    }
    if (blockedWebsites.some((blocked) => url.hostname.includes(blocked))) {
      chrome.tabs.update(details.tabId, {
        url: chrome.runtime.getURL("./src/blocked.html"),
      });
    }
  });
});
