document
  .getElementById("remove-element-button")
  .addEventListener("click", function () {
    chrome.runtime.sendMessage({ action: "startElementRemoval" });
  });

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "elementRemoved") {
    const resultDiv = document.getElementById("result");
    console.log(resultDiv);
  }
});
