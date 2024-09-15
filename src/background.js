chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "startElementRemoval") {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0])
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "startElementRemoval",
        });
    });
  } else if (request.action === "elementRemoved") {
    chrome.runtime.sendMessage(request);

    // Store the removed element info
    chrome.storage.local.get({ removedElements: {} }, function (result) {
      let removedElements = result.removedElements;
      if (!removedElements[sender.tab.url]) {
        removedElements[sender.tab.url] = [];
      }
      removedElements[sender.tab.url].push(request.data);
      chrome.storage.local.set({ removedElements: removedElements });
    });
  }
});
