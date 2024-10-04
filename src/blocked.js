const urlParams = new URLSearchParams(window.location.search);
const originalUrl = urlParams.get("originalUrl");
if (originalUrl) {
  localStorage.setItem("blockedUrl", originalUrl);
}

if (
  typeof chrome !== "undefined" &&
  chrome.runtime &&
  chrome.runtime.onMessage
) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateExtensionState" && !request.isEnabled) {
      const blockedUrl = localStorage.getItem("blockedUrl");
      if (blockedUrl) {
        window.location.href = blockedUrl;
      }
    }
  });
} else {
  console.log(
    "Chrome runtime API not available. This page might be loaded outside of the extension context."
  );
}
