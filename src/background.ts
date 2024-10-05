let tabsWithContentScript = new Set();

function handleExtensionStateChange(isEnabled: any) {
  if (!isEnabled) unblockAllTabs();
}

function checkContentScript(tabId: any) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: "ping" }, () => {
      if (chrome.runtime.lastError) {
        resolve(false);
      } else {
        tabsWithContentScript.add(tabId);
        resolve(true);
      }
    });
  });
}

async function handleStartInspection() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab) {
      throw new Error("No active tab found");
    }

    const isContentScriptReady = await checkContentScript(tab.id);
    if (isContentScriptReady && tab.id) {
      chrome.tabs.sendMessage(tab.id, { action: "startInspection" });
    } else {
      chrome.runtime.sendMessage({ action: "contentScriptNotReady" });
    }
  } catch (error) {
    console.error("Error in handleStartInspection:", error);
    chrome.runtime.sendMessage({ action: "contentScriptNotReady" });
  }
}

function handleCancelInspection() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs[0] && tabsWithContentScript.has(tabs[0].id) && tabs[0].id)
      chrome.tabs.sendMessage(tabs[0].id, { action: "cancelInspection" });
  });
}

function handleElementRemoved(request: any, sender: any) {
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

function unblockAllTabs() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (
        tab &&
        tab.url &&
        tab.id &&
        tab.url.startsWith(chrome.runtime.getURL("./blocked.html"))
      ) {
        chrome.tabs.sendMessage(
          tab.id,
          { action: "updateExtensionState", isEnabled: false },
          () => {
            if (chrome.runtime.lastError) {
              console.log(
                "Error sending message to tab:",
                chrome.runtime.lastError
              );
            }
          }
        );
      }
    });
  });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete") {
    checkContentScript(tabId);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabsWithContentScript.delete(tabId);
});

chrome.runtime.onMessage.addListener((request, sender) => {
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
    case "updateExtensionState":
      handleExtensionStateChange(request.isEnabled);
      break;
  }
});

chrome.webNavigation.onDOMContentLoaded.addListener((details) => {
  chrome.storage.local.get(
    { blockedWebsites: [], extensionEnabled: true },
    function (result) {
      if (!result.extensionEnabled) return;

      let blockedWebsites = result.blockedWebsites;
      let url;
      try {
        url = new URL(details.url);
      } catch (e) {
        console.error("Invalid URL:", details.url);
        return;
      }
      if (blockedWebsites.some((blocked: any) => url.hostname.includes(blocked))) {
        chrome.tabs.update(details.tabId, {
          url: chrome.runtime.getURL(
            `./blocked.html?originalUrl=${encodeURIComponent(details.url)}`
          ),
        });
      }
    }
  );
});