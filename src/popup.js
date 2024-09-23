document.addEventListener("DOMContentLoaded", function () {
  const mainTab = document.getElementById("main-tab");
  const listTab = document.getElementById("list-tab");
  const blockTab = document.getElementById("block-tab");
  const mainContent = document.getElementById("main-content");
  const listContent = document.getElementById("list-content");
  const blockContent = document.getElementById("block-content");
  const inspectButton = document.getElementById("inspect-button");
  const cancelButton = document.getElementById("cancel-button");
  const resultDiv = document.getElementById("result");
  const deletedList = document.getElementById("deleted-list");
  const websiteInput = document.getElementById("website-input");
  const blockButton = document.getElementById("block-button");
  const blockedList = document.getElementById("blocked-list");
  const websiteSearch = document.getElementById("website-search");

  let isInspecting = false;

  function showTab(tabContent) {
    [mainContent, listContent, blockContent].forEach((content) => {
      if (content) {
        content.classList.add("hidden");
      }
    });
    if (tabContent) {
      tabContent.classList.remove("hidden");
    }
  }

  mainTab.addEventListener("click", (e) => {
    e.preventDefault();
    showTab(mainContent);
    [mainTab, listTab, blockTab].forEach((tab) =>
      tab.classList.remove("bg-white", "border-l", "border-t", "border-r")
    );
    mainTab.classList.add("bg-white", "border-l", "border-t", "border-r");
  });

  listTab.addEventListener("click", (e) => {
    e.preventDefault();
    showTab(listContent);
    [mainTab, listTab, blockTab].forEach((tab) =>
      tab.classList.remove("bg-white", "border-l", "border-t", "border-r")
    );
    listTab.classList.add("bg-white", "border-l", "border-t", "border-r");
    websiteSearch.value = "";
    updateDeletedList();
  });

  blockTab.addEventListener("click", (e) => {
    e.preventDefault();
    showTab(blockContent);
    [mainTab, listTab, blockTab].forEach((tab) =>
      tab.classList.remove("bg-white", "border-l", "border-t", "border-r")
    );
    blockTab.classList.add("bg-white", "border-l", "border-t", "border-r");
    updateBlockedList();
  });

  inspectButton.addEventListener("click", function () {
    if (!isInspecting) {
      isInspecting = true;
      chrome.runtime.sendMessage({ action: "startInspection" });
      updateInspectionState();
    }
  });

  cancelButton.addEventListener("click", function () {
    if (isInspecting) {
      isInspecting = false;
      chrome.runtime.sendMessage({ action: "cancelInspection" });
      updateInspectionState();
    }
  });

  function updateInspectionState() {
    if (isInspecting) {
      inspectButton.classList.add("hidden");
      cancelButton.classList.remove("hidden");
      resultDiv.textContent =
        "Inspecting... Click an element to remove it or press ESC to cancel.";
    } else {
      inspectButton.classList.remove("hidden");
      cancelButton.classList.add("hidden");
      resultDiv.textContent = "";
    }
  }

  chrome.runtime.onMessage.addListener(function (
    request,
    sender,
    sendResponse
  ) {
    if (request.action === "elementRemoved") {
      isInspecting = false;
      updateInspectionState();
      resultDiv.innerHTML = `
        <p class="font-semibold">Element removed:</p>
        <p>Tag: ${request.data.tagName}</p>
        <p>ID: ${request.data.id || "N/A"}</p>
        <p>Classes: ${request.data.classes.join(", ") || "N/A"}</p>
      `;
      updateDeletedList();
    } else if (request.action === "contentScriptNotReady") {
      alert(
        "Please refresh the page and try again. The extension wasn't ready."
      );
      isInspecting = false;
      updateInspectionState();
    } else if (request.action === "inspectionCanceled") {
      isInspecting = false;
      updateInspectionState();
    }
  });

  websiteSearch.addEventListener("input", function () {
    updateDeletedList(this.value);
  });

  function updateDeletedList(searchTerm = "") {
    chrome.storage.local.get({ removedElements: {} }, function (result) {
      let removedElements = result.removedElements;
      deletedList.innerHTML = "";

      let hasElements = false;

      for (let url in removedElements) {
        if (
          searchTerm &&
          !url.toLowerCase().includes(searchTerm.toLowerCase())
        ) {
          continue;
        }

        hasElements = true;
        let urlDiv = document.createElement("div");
        urlDiv.className = "mb-4";
        urlDiv.innerHTML = `
          <h3 class="font-semibold text-lg">${new URL(url).hostname}</h3>
          <ul class="list-disc pl-5">
            ${removedElements[url]
              .map(
                (el, index) => `
              <li class="flex items-center justify-between">
                <span>
                  ${el.tagName}
                  ${el.id ? `#${el.id}` : ""}
                  ${el.classes.length ? `.${el.classes.join(".")}` : ""}
                </span>
                <button class="restore-btn text-red-500 hover:text-red-700" data-url="${url}" data-index="${index}">
                  <i class="fas fa-trash-alt"></i>
                </button>
              </li>
            `
              )
              .join("")}
          </ul>
        `;
        deletedList.appendChild(urlDiv);
      }

      if (!hasElements) {
        deletedList.innerHTML = searchTerm
          ? "<p>No matching websites found.</p>"
          : "<p>No elements have been deleted yet.</p>";
      }

      document.querySelectorAll(".restore-btn").forEach((btn) => {
        btn.addEventListener("click", function () {
          restoreElement(this.dataset.url, parseInt(this.dataset.index));
        });
      });
    });
  }

  function restoreElement(url, index) {
    chrome.storage.local.get({ removedElements: {} }, function (result) {
      let removedElements = result.removedElements;
      if (removedElements[url] && removedElements[url][index]) {
        let restoredElement = removedElements[url].splice(index, 1)[0];
        if (removedElements[url].length === 0) {
          delete removedElements[url];
        }
        chrome.storage.local.set(
          { removedElements: removedElements },
          function () {
            updateDeletedList(websiteSearch.value);
            chrome.tabs.query({ url: url }, function (tabs) {
              if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, {
                  action: "restoreElement",
                  data: restoredElement,
                });
              }
            });
          }
        );
      }
    });
  }

  blockButton.addEventListener("click", function () {
    const website = websiteInput.value.trim();
    if (website) {
      chrome.storage.local.get({ blockedWebsites: [] }, function (result) {
        let blockedWebsites = result.blockedWebsites;
        if (!blockedWebsites.includes(website)) {
          blockedWebsites.push(website);
          chrome.storage.local.set(
            { blockedWebsites: blockedWebsites },
            function () {
              websiteInput.value = "";
              updateBlockedList();
            }
          );
        }
      });
    }
  });

  function updateBlockedList() {
    chrome.storage.local.get({ blockedWebsites: [] }, function (result) {
      let blockedWebsites = result.blockedWebsites;
      blockedList.innerHTML = "";

      blockedWebsites.forEach((website, index) => {
        let websiteDiv = document.createElement("div");
        websiteDiv.className =
          "flex items-center justify-between bg-white p-2 rounded";
        websiteDiv.innerHTML = `
          <span>${website}</span>
          <button class="unblock-btn text-red-500 hover:text-red-700" data-index="${index}">
            <i class="fas fa-times"></i>
          </button>
        `;
        blockedList.appendChild(websiteDiv);
      });

      if (blockedWebsites.length === 0) {
        blockedList.innerHTML = "<p>No websites are currently blocked.</p>";
      }

      document.querySelectorAll(".unblock-btn").forEach((btn) => {
        btn.addEventListener("click", function () {
          unblockWebsite(parseInt(this.dataset.index));
        });
      });
    });
  }

  function unblockWebsite(index) {
    chrome.storage.local.get({ blockedWebsites: [] }, function (result) {
      let blockedWebsites = result.blockedWebsites;
      blockedWebsites.splice(index, 1);
      chrome.storage.local.set(
        { blockedWebsites: blockedWebsites },
        function () {
          updateBlockedList();
        }
      );
    });
  }

  showTab(mainContent);
  updateBlockedList();
  updateDeletedList();
  updateInspectionState();
});
