import "./popup.css"

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
  const websiteInput = (document.getElementById("website-input")) as HTMLInputElement;
  const blockButton = document.getElementById("block-button");
  const blockedList = document.getElementById("blocked-list");
  const websiteSearch = document.getElementById("website-search") as HTMLInputElement;
  const extensionToggle = document.getElementById("extension-toggle") as HTMLInputElement;
  const disabledMessage = document.getElementById("disabled-text");
  const navbar = document.getElementById("navbar");
  const hr = document.querySelector("hr");
  const body = document.querySelector("body");
  let isInspecting = false;

  function showTab(tabContent: any) {
    [mainContent, listContent, blockContent].forEach((content) => {
      if (content) content.classList.add("hidden");
    });
    if (tabContent) tabContent.classList.remove("hidden");
  }

  function unblockWebsite(index: any) {
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

  function updateInspectionState() {
    chrome.storage.local.get({ extensionEnabled: true }, function (result) {
      const isEnabled = result.extensionEnabled;

      if (isInspecting) {
        navbar!.style.display = "none";
        hr!.style.display = "none";
        body!.style.height = "50px";
        body!.style.width = "50px";
        mainContent!.style.display = "block";
        inspectButton!.style.display = "none";
        cancelButton!.style.display = "block";
        disabledMessage!.style.display = "none";
      } else {
        navbar!.style.display = "flex";
        hr!.style.display = "block";
        body!.style.height = "300px";
        body!.style.width = "350px";
        mainContent!.style.display = "flex";
        cancelButton!.style.display = "none";
        if (isEnabled) {
          inspectButton!.style.display = "block";
          disabledMessage!.style.display = "none";
        } else {
          inspectButton!.style.display = "none";
          disabledMessage!.style.display = "flex";
        }
      }
    });
  }

  function updateDeletedList(searchTerm = "") {
    chrome.storage.local.get({ removedElements: {} }, function (result) {
      let removedElements = result.removedElements;
      deletedList!.innerHTML = "";

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
                (el: any, index: any) => `
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

        deletedList!.appendChild(urlDiv);
      }

      if (!hasElements) {
        deletedList!.innerHTML = searchTerm
          ? "<p class='no-results-text'>No matching websites found.</p>"
          : "<p class='no-results-text'>No elements have been deleted yet.</p>";
      }

      document.querySelectorAll(".restore-button").forEach((btn) => {
        btn.addEventListener("click", function (this: HTMLButtonElement) {
          if(!this.dataset.index) return;
          restoreElement(this.dataset.url, parseInt(this.dataset.index));
        });
      });
    });
  }

  function restoreElement(url: any, index: any) {
    chrome.storage.local.get({ removedElements: {} }, function (result) {
      let removedElements = result.removedElements;

      if (removedElements[url] && removedElements[url][index]) {
        let restoredElement = removedElements[url].splice(index, 1)[0];
        if (removedElements[url].length === 0) delete removedElements[url];

        chrome.storage.local.set(
          { removedElements: removedElements },
          function () {
            updateDeletedList((websiteSearch as HTMLInputElement).value);
            chrome.tabs.query({ url: url }, function (tabs) {
              if (tabs.length > 0 && tabs[0].id) {
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
      blockedList!.innerHTML = "";

      blockedWebsites.forEach((website: any, index: any) => {
        let websiteDiv = document.createElement("div");
        websiteDiv.classList.add("removed-element-container");
        websiteDiv.innerHTML = `
            <span>${website}</span>
            <button class="unblock-button data-index="${index}">
                <img srcset="../assets/icons/trash-solid.svg" class="trash-icon">
            </button>
        `;
        blockedList!.appendChild(websiteDiv);
      });

      if (blockedWebsites.length === 0)
        blockedList!.innerHTML =
          "<p class='no-results-text'>No websites are currently blocked.</p>";

      document.querySelectorAll(".unblock-button").forEach((btn) => {
        btn.addEventListener("click", function (this: HTMLButtonElement) {
          if(!this.dataset.index) return;
          unblockWebsite(parseInt(this.dataset.index));
        });
      });
    });
  }

  extensionToggle?.addEventListener("change", function () {
    const isEnabled = this.checked;
    chrome.storage.local.set({ extensionEnabled: isEnabled }, function () {
      chrome.runtime.sendMessage({
        action: "updateExtensionState",
        isEnabled: isEnabled,
      });

      chrome.tabs.query({}, function (tabs) {
        tabs.forEach(function (tab) {
          if(!tab.id) return
          chrome.tabs.sendMessage(tab.id, {
            action: "updateExtensionState",
            isEnabled: isEnabled,
          });
        });
      });

      updateInspectionState();
    });
  });

  mainTab?.addEventListener("click", (e) => {
    e.preventDefault();
    showTab(mainContent);
    [mainTab, listTab, blockTab].forEach((tab) =>
      tab?.classList.remove("selected-tab")
    );
    mainTab.classList.add("selected-tab");
  });

  listTab?.addEventListener("click", (e) => {
    e.preventDefault();
    showTab(listContent);
    [mainTab, listTab, blockTab].forEach((tab) =>
      tab?.classList.remove("selected-tab")
    );
    listTab.classList.add("selected-tab");
    websiteSearch.value = "";
    updateDeletedList();
  });

  blockTab?.addEventListener("click", (e) => {
    e.preventDefault();
    showTab(blockContent);
    [mainTab, listTab, blockTab].forEach((tab) =>
      tab?.classList.remove("selected-tab")
    );
    blockTab.classList.add("selected-tab");
    updateBlockedList();
  });

  inspectButton?.addEventListener("click", function () {
    if (!isInspecting) {
      isInspecting = true;
      chrome.runtime.sendMessage({ action: "startInspection" });
      updateInspectionState();
    }
  });

  cancelButton?.addEventListener("click", function () {
    if (isInspecting) {
      isInspecting = false;
      chrome.runtime.sendMessage({ action: "cancelInspection" });
      updateInspectionState();
    }
  });

  chrome.runtime.onMessage.addListener(function (request) {
    if (request.action === "elementRemoved") {
      isInspecting = false;
      updateInspectionState();
      updateDeletedList();
    } else if (request.action === "contentScriptNotReady") {
      alert("Something went wrong - please refresh the page and try again.");
      isInspecting = false;
      updateInspectionState();
    } else if (request.action === "inspectionCanceled") {
      isInspecting = false;
      updateInspectionState();
    }
  });

  websiteSearch?.addEventListener("input", function () {
    updateDeletedList((websiteSearch as HTMLInputElement).value);
  });

  blockButton?.addEventListener("click", function () {
    const website = websiteInput?.value.trim();
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
    if(!extensionToggle) return
    extensionToggle.checked = result.extensionEnabled;
    updateInspectionState();
  });

  showTab(mainContent);
  updateBlockedList();
  updateDeletedList();
});


document.querySelector<HTMLElement>('body')!.innerHTML = `
<!DOCTYPE html>
<html>
  <head>
    <title>Distill</title>
    <link rel="stylesheet" href="popup.css" />
  </head>
  <body>
    <div id="navbar" class="navbar">
      <div class="left">
        <img src="../assets/icons/logo.svg" class="logo" />
      </div>
      <div class="right">
        <div class="tabs-container">
          <ul class="tabs">
            <li class="tab">
              <a href="#" id="main-tab" class="selected-tab tab-link">Main</a>
            </li>
            <li class="tab">
              <a href="#" id="list-tab">Elements</a>
            </li>
            <li class="tab">
              <a href="#" id="block-tab">Websites</a>
            </li>
          </ul>
        </div>
      </div>
      <div class="toggle-container">
        <label class="toggle-switch">
          <input type="checkbox" id="extension-toggle" checked />
          <span class="slider round"></span>
        </label>
      </div>
    </div>
    <hr />
    <div id="main-content" class="main-content">
      <p id="disabled-text" class="disabled-text">
        Distill is currently disabled.
        <br />
        Please re-enable the extension to block new elements.
      </p>
      <button id="inspect-button" class="inspect-button">Remove Element</button>
      <button id="cancel-button" class="cancel-button">Cancel</button>
    </div>
    <div id="list-content" class="list-content">
      <input
        type="text"
        id="website-search"
        placeholder="Search websites..."
        class="input"
      />
      <div id="deleted-list" class="removed-elements-list-container"></div>
    </div>
    <div id="block-content" class="blocked-content">
      <div class="input-website-container">
        <input
          type="text"
          id="website-input"
          class="input website-input"
          placeholder="Enter website URL"
        />
        <button id="block-button" class="block-button">Block</button>
      </div>
      <div id="blocked-list" class="blocked-websites-list"></div>
    </div>
  </body>
</html>
`;