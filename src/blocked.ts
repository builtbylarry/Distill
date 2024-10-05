const urlParams = new URLSearchParams(window.location.search);
const originalUrl = urlParams.get("originalUrl");
if (originalUrl) localStorage.setItem("blockedUrl", originalUrl);

if (
  typeof chrome !== "undefined" &&
  chrome.runtime &&
  chrome.runtime.onMessage
) {
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "updateExtensionState" && !request.isEnabled) {
      const blockedUrl = localStorage.getItem("blockedUrl");
      if (blockedUrl) window.location.href = blockedUrl;
    }
  });
}
