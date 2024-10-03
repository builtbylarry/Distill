const urlParams = new URLSearchParams(window.location.search);
const originalUrl = urlParams.get("originalUrl");

if (originalUrl) {
  localStorage.setItem("blockedUrl", originalUrl);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateExtensionState" && !request.isEnabled) {
    const blockedUrl = localStorage.getItem("blockedUrl");
    if (blockedUrl) {
      window.location.href = blockedUrl;
    }
  }
});
