document.addEventListener("DOMContentLoaded", function () {
  const mainTab = document.getElementById("main-tab");
  const listTab = document.getElementById("list-tab");
  const blockTab = document.getElementById("block-tab");
  const mainContent = document.getElementById("main-content");
  const listContent = document.getElementById("list-content");
  const blockContent = document.getElementById("block-content");
  const inspectButton = document.getElementById("inspect-button");
  const cancelButton = document.getElementById("cancel-button");
  const deletedList = document.getElementById("deleted-list");
  const websiteInput = document.getElementById("website-input");
  const blockButton = document.getElementById("block-button");
  const blockedList = document.getElementById("blocked-list");
  const websiteSearch = document.getElementById("website-search");
  const extensionToggle = document.getElementById("extension-toggle");
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

  function updateInspectionState() {
    if (isInspecting) {
      inspectButton.classList.add("hidden");
      cancelButton.classList.remove("hidden");
    } else {
      inspectButton.classList.remove("hidden");
      cancelButton.classList.add("hidden");
    }
  }

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
        urlDiv.innerHTML = `
          <h3 class="removed-elements-website-name">${
            new URL(url).hostname
          }</h3>
          <div class="removed-elements-list">
            ${removedElements[url]
              .map(
                (el, index) => `
              <div class="removed-element-container">
                <div class="removed-element-name">
                  ${el.tagName}
                  ${el.classes.length ? `.${el.classes.join(".")}` : ""}
                </div>
                <button class="restore-button" data-url="${url}" data-index="${index}">
                  <img srcset="../assets/icons/trash-solid.svg" class="trash-icon">
                </button>
              </div>
            `
              )
              .join("")}
          </div>
        `;
        deletedList.appendChild(urlDiv);
      }

      if (!hasElements) {
        deletedList.innerHTML = searchTerm
          ? "<p class='no-results-text'>No matching websites found.</p>"
          : "<p class='no-results-text'>No elements have been deleted yet.</p>";
      }

      document.querySelectorAll(".restore-button").forEach((btn) => {
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

  function updateBlockedList() {
    chrome.storage.local.get({ blockedWebsites: [] }, function (result) {
      let blockedWebsites = result.blockedWebsites;
      blockedList.innerHTML = "";

      blockedWebsites.forEach((website, index) => {
        let websiteDiv = document.createElement("div");
        websiteDiv.classList.add("removed-element-container");
        websiteDiv.innerHTML = `
            <span>${website}</span>
            <button class="unblock-button data-index="${index}">
                <img srcset="../assets/icons/trash-solid.svg" class="trash-icon">
            </button>
        `;
        blockedList.appendChild(websiteDiv);
      });

      if (blockedWebsites.length === 0) {
        blockedList.innerHTML =
          "<p class='no-results-text'>No websites are currently blocked.</p>";
      }

      document.querySelectorAll(".unblock-button").forEach((btn) => {
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

  extensionToggle.addEventListener("change", function () {
    const isEnabled = this.checked;
    chrome.storage.local.set({ extensionEnabled: isEnabled }, function () {
      chrome.runtime.sendMessage({
        action: "updateExtensionState",
        isEnabled: isEnabled,
      });

      chrome.tabs.query({}, function (tabs) {
        tabs.forEach(function (tab) {
          chrome.tabs.sendMessage(tab.id, {
            action: "updateExtensionState",
            isEnabled: isEnabled,
          });
        });
      });
    });
  });

  mainTab.addEventListener("click", (e) => {
    e.preventDefault();
    showTab(mainContent);
    [mainTab, listTab, blockTab].forEach((tab) =>
      tab.classList.remove("selected-tab")
    );
    mainTab.classList.add("selected-tab");
  });

  listTab.addEventListener("click", (e) => {
    e.preventDefault();
    showTab(listContent);
    [mainTab, listTab, blockTab].forEach((tab) =>
      tab.classList.remove("selected-tab")
    );
    listTab.classList.add("selected-tab");
    websiteSearch.value = "";
    updateDeletedList();
  });

  blockTab.addEventListener("click", (e) => {
    e.preventDefault();
    showTab(blockContent);
    [mainTab, listTab, blockTab].forEach((tab) =>
      tab.classList.remove("selected-tab")
    );
    blockTab.classList.add("selected-tab");
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

  chrome.runtime.onMessage.addListener(function (
    request,
    sender,
    sendResponse
  ) {
    if (request.action === "elementRemoved") {
      isInspecting = false;
      updateInspectionState();
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

  chrome.storage.local.get({ extensionEnabled: true }, function (result) {
    extensionToggle.checked = result.extensionEnabled;
  });

  showTab(mainContent);
  updateBlockedList();
  updateDeletedList();
  updateInspectionState();
});
