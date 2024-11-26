const tabsWithContentScript = new Set<number>();

async function handleStartInspection(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) throw new Error("No active tab found");
    chrome.tabs.sendMessage(tab.id, { action: "startInspection" });
  } catch (error) {
    console.error("Error in handleStartInspection:", error);
    chrome.runtime.sendMessage({ action: "contentScriptNotReady" });
  }
}

async function handleCancelInspection(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id && tabsWithContentScript.has(tab.id)) {
    chrome.tabs.sendMessage(tab.id, { action: "cancelInspection" });
  }
}

function handleElementRemoved(
  request: any,
  sender: chrome.runtime.MessageSender
): void {
  chrome.storage.local.get({ removedElements: {} }, (result) => {
    const removedElements = result.removedElements as RemovedElements;
    const url = sender.tab?.url;
    if (url) {
      const hostname = new URL(url).hostname;
      if (!removedElements[hostname]) {
        removedElements[hostname] = [];
      }
      const removedElement: RemovedElement = {
        ...request.data,
        url: url,
      };
      removedElements[hostname].push(removedElement);
      chrome.storage.local.set({ removedElements });
    }
  });
}

async function unblockAllTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  tabs.forEach((tab) => {
    if (
      tab?.url?.startsWith(chrome.runtime.getURL("./blocked.html")) &&
      tab.id
    ) {
      chrome.tabs
        .sendMessage(tab.id, {
          action: "updateExtensionState",
          isEnabled: false,
        })
        .catch((error) => console.log("Error sending message to tab:", error));
    }
  });
}

function handleExtensionStateChange(isEnabled: boolean): void {
  if (!isEnabled) unblockAllTabs();
}

async function handleApplyPresets(request: any): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    
    chrome.tabs.sendMessage(tab.id, {
      action: "applyPresets",
      platform: request.platform,
      presets: request.presets
    }).catch(error => {
      console.error("Error applying presets:", error);
      chrome.runtime.sendMessage({ action: "contentScriptNotReady" });
    });
  } catch (error) {
    console.error("Error in handleApplyPresets:", error);
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    tabsWithContentScript.add(tabId);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabsWithContentScript.delete(tabId);
});

chrome.webNavigation.onDOMContentLoaded.addListener((details) => {
  chrome.storage.local.get(
    { blockedWebsites: [], extensionEnabled: true },
    (result) => {
      if (!result.extensionEnabled) return;

      const blockedWebsites = result.blockedWebsites as string[];
      const url = new URL(details.url);
      if (blockedWebsites.some((blocked) => url.hostname.includes(blocked))) {
        chrome.tabs.update(details.tabId, {
          url: chrome.runtime.getURL(
            `./blocked.html?originalUrl=${encodeURIComponent(details.url)}`
          ),
        });
      }
    }
  );
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
    case "updateExtensionState":
      handleExtensionStateChange(request.isEnabled);
      break;
    case "ping":
      if (sender.tab?.id && tabsWithContentScript.has(sender.tab.id)) {
        sendResponse({ status: "ready" });
      } else {
        sendResponse({ status: "not_ready" });
      }
      return true;
    case "applyPresets":
      handleApplyPresets(request);
      break;
  }
});
