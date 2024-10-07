export interface Tab extends chrome.tabs.Tab {}

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
  chrome.runtime.sendMessage(request);

  chrome.storage.local.get({ removedElements: {} }, (result) => {
    const removedElements = result.removedElements as Record<string, any[]>;
    const url = sender.tab?.url;
    if (url) {
      if (!removedElements[url]) {
        removedElements[url] = [];
      }
      removedElements[url].push(request.data);
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
