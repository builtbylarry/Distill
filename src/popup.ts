import PopupPage from "./popup.html?raw";
import "./popup.css";

type ElementId = keyof typeof elementIds;
type Elements = Record<ElementId, HTMLElement | null>;

interface RemovedElement {
  tagName: string;
  classes: string[];
}

interface RemovedElements {
  [url: string]: RemovedElement[];
}

const elementIds = {
  mainTab: "main-tab",
  listTab: "list-tab",
  blockTab: "block-tab",
  mainContent: "main-content",
  listContent: "list-content",
  blockContent: "block-content",
  inspectButton: "inspect-button",
  cancelButton: "cancel-button",
  deletedList: "deleted-list",
  websiteInput: "website-input",
  blockButton: "block-button",
  blockedList: "blocked-list",
  websiteSearch: "website-search",
  extensionToggle: "extension-toggle",
  disabledText: "disabled-text",
  navbar: "navbar",
  hr: "hr",
  body: "body",
} as const;

let isInspecting = false;
const elements: Elements = {} as Elements;

function initializeElements(): void {
  Object.entries(elementIds).forEach(([key, id]) => {
    elements[key as ElementId] = document.getElementById(id);
  });
  elements.hr = document.querySelector("hr");
  elements.body = document.body;
}

function addEventListeners(): void {
  elements.mainTab?.addEventListener("click", (e) =>
    handleTabClick(e, elements.mainContent)
  );
  elements.listTab?.addEventListener("click", (e) =>
    handleTabClick(e, elements.listContent)
  );
  elements.blockTab?.addEventListener("click", (e) =>
    handleTabClick(e, elements.blockContent)
  );
  elements.inspectButton?.addEventListener("click", startInspection);
  elements.cancelButton?.addEventListener("click", cancelInspection);
  elements.extensionToggle?.addEventListener("change", toggleExtension);
  elements.websiteSearch?.addEventListener("input", () => updateDeletedList());
  elements.blockButton?.addEventListener("click", blockWebsite);

  chrome.runtime.onMessage.addListener(handleMessage);
}

function handleTabClick(e: Event, content: HTMLElement | null): void {
  if (!content) return;
  e.preventDefault();
  showTab(content);
  updateTabSelection(e.currentTarget as HTMLElement);
  handleTabSpecificActions(content);
}

function showTab(tabContent: HTMLElement): void {
  [elements.mainContent, elements.listContent, elements.blockContent].forEach(
    (content) => {
      content?.classList.toggle("hidden", content !== tabContent);
    }
  );
}

function updateTabSelection(selectedTab: HTMLElement): void {
  [elements.mainTab, elements.listTab, elements.blockTab].forEach((tab) => {
    tab?.classList.toggle("selected-tab", tab === selectedTab);
  });
}

function handleTabSpecificActions(content: HTMLElement): void {
  if (content === elements.listContent) {
    if (elements.websiteSearch instanceof HTMLInputElement)
      elements.websiteSearch.value = "";
    updateDeletedList();
  } else if (content === elements.blockContent) {
    updateBlockedList();
  }
}

function startInspection(): void {
  if (!isInspecting) {
    isInspecting = true;
    chrome.runtime.sendMessage({ action: "startInspection" });
    updateInspectionState();
  }
}

function cancelInspection(): void {
  if (isInspecting) {
    isInspecting = false;
    chrome.runtime.sendMessage({ action: "cancelInspection" });
    updateInspectionState();
  }
}

function toggleExtension(): void {
  const isEnabled =
    elements.extensionToggle instanceof HTMLInputElement &&
    elements.extensionToggle.checked;
  chrome.storage.local.set({ extensionEnabled: isEnabled }, () => {
    chrome.runtime.sendMessage({ action: "updateExtensionState", isEnabled });
    updateTabsExtensionState(isEnabled);
    updateInspectionState();
  });
}

function updateTabsExtensionState(isEnabled: boolean): void {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id)
        chrome.tabs.sendMessage(tab.id, {
          action: "updateExtensionState",
          isEnabled,
        });
    });
  });
}

function blockWebsite(): void {
  const website =
    elements.websiteInput instanceof HTMLInputElement
      ? elements.websiteInput.value.trim()
      : "";
  if (website) {
    chrome.storage.local.get({ blockedWebsites: [] }, (result) => {
      const blockedWebsites: string[] = result.blockedWebsites;
      if (!blockedWebsites.includes(website)) {
        blockedWebsites.push(website);
        chrome.storage.local.set({ blockedWebsites }, () => {
          if (elements.websiteInput instanceof HTMLInputElement)
            elements.websiteInput.value = "";
          updateBlockedList();
        });
      }
    });
  }
}

function updateInspectionState(): void {
  chrome.storage.local.get({ extensionEnabled: true }, (result) => {
    const isEnabled = result.extensionEnabled;
    updateUIForInspectionState(isEnabled);
  });
}

function updateUIForInspectionState(isEnabled: boolean): void {
  if (elements.navbar)
    elements.navbar.style.display = isInspecting ? "none" : "flex";

  if (elements.hr) elements.hr.style.display = isInspecting ? "none" : "block";

  if (elements.body) {
    elements.body.style.height = isInspecting ? "50px" : "300px";
    elements.body.style.width = isInspecting ? "50px" : "350px";
  }

  if (elements.mainContent)
    elements.mainContent.style.display = isInspecting ? "block" : "flex";

  if (elements.inspectButton)
    elements.inspectButton.style.display = isInspecting
      ? "none"
      : isEnabled
      ? "block"
      : "none";

  if (elements.cancelButton)
    elements.cancelButton.style.display = isInspecting ? "block" : "none";

  if (elements.disabledText)
    elements.disabledText.style.display =
      !isInspecting && !isEnabled ? "flex" : "none";
}

function updateDeletedList(searchTerm = ""): void {
  chrome.storage.local.get({ removedElements: {} }, (result) => {
    const removedElements: RemovedElements = result.removedElements;
    if (elements.deletedList) elements.deletedList.innerHTML = "";

    const filteredElements = filterRemovedElements(removedElements, searchTerm);

    if (filteredElements.length === 0) {
      displayNoResultsMessage(searchTerm);
      return;
    }

    displayFilteredElements(filteredElements);
  });
}

function filterRemovedElements(
  removedElements: RemovedElements,
  searchTerm: string
): [string, RemovedElement[]][] {
  return Object.entries(removedElements).filter(
    ([url]) =>
      !searchTerm || url.toLowerCase().includes(searchTerm.toLowerCase())
  );
}

function displayNoResultsMessage(searchTerm: string): void {
  if (elements.deletedList) {
    elements.deletedList.innerHTML = searchTerm
      ? "<p class='no-results-text'>No matching websites found.</p>"
      : "<p class='no-results-text'>No elements have been deleted yet.</p>";
  }
}

function displayFilteredElements(
  filteredElements: [string, RemovedElement[]][]
): void {
  filteredElements.forEach(([url, removedEls]) => {
    const urlDiv = createUrlDiv(url, removedEls);
    elements.deletedList?.appendChild(urlDiv);
  });

  addRestoreButtonListeners();
}

function createUrlDiv(
  url: string,
  removedEls: RemovedElement[]
): HTMLDivElement {
  const urlDiv = document.createElement("div");
  urlDiv.innerHTML = `
    <h3 class="removed-elements-website-name">${new URL(url).hostname}</h3>
    <div class="removed-elements-list">
      ${removedEls
        .map((el, index) => createRemovedElementHTML(url, el, index))
        .join("")}
    </div>
  `;
  return urlDiv;
}

function createRemovedElementHTML(
  url: string,
  el: RemovedElement,
  index: number
): string {
  return `
    <div class="removed-element-container">
      <div class="removed-element-name">
        ${el.tagName}${el.classes.length ? `.${el.classes.join(".")}` : ""}
      </div>
      <button class="restore-button" data-url="${url}" data-index="${index}">
        <img src="../assets/icons/trash-solid.svg" alt="Restore" class="trash-icon">
      </button>
    </div>
  `;
}

function addRestoreButtonListeners(): void {
  elements.deletedList?.querySelectorAll(".restore-button").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      const url = target.dataset.url;
      const index = parseInt(target.dataset.index || "");
      if (url && !isNaN(index)) restoreElement(url, index);
    });
  });
}

function restoreElement(url: string, index: number): void {
  chrome.storage.local.get({ removedElements: {} }, (result) => {
    const removedElements: RemovedElements = result.removedElements;
    if (removedElements[url] && removedElements[url][index]) {
      const restoredElement = removedElements[url].splice(index, 1)[0];
      if (removedElements[url].length === 0) delete removedElements[url];

      chrome.storage.local.set({ removedElements }, () => {
        updateDeletedList(
          elements.websiteSearch instanceof HTMLInputElement
            ? elements.websiteSearch.value
            : ""
        );
        sendRestoreMessageToTab(url, restoredElement);
      });
    }
  });
}

function sendRestoreMessageToTab(
  url: string,
  restoredElement: RemovedElement
): void {
  chrome.tabs.query({ url }, (tabs) => {
    if (tabs.length > 0 && tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "restoreElement",
        data: restoredElement,
      });
    }
  });
}

function updateBlockedList(): void {
  chrome.storage.local.get({ blockedWebsites: [] }, (result) => {
    const blockedWebsites: string[] = result.blockedWebsites;
    if (elements.blockedList) {
      elements.blockedList.innerHTML = blockedWebsites.length
        ? blockedWebsites.map(createBlockedWebsiteHTML).join("")
        : "<p class='no-results-text'>No websites are currently blocked.</p>";

      addUnblockButtonListeners();
    }
  });
}

function createBlockedWebsiteHTML(website: string, index: number): string {
  return `
    <div class="removed-element-container">
      <span>${website}</span>
      <button class="unblock-button" data-index="${index}">
        <img src="../assets/icons/trash-solid.svg" alt="Unblock" class="trash-icon">
      </button>
    </div>
  `;
}

function addUnblockButtonListeners(): void {
  elements.blockedList?.querySelectorAll(".unblock-button").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const index = parseInt(
        (e.currentTarget as HTMLButtonElement).dataset.index || ""
      );
      if (!isNaN(index)) unblockWebsite(index);
    });
  });
}

function unblockWebsite(index: number): void {
  chrome.storage.local.get({ blockedWebsites: [] }, (result) => {
    const blockedWebsites: string[] = result.blockedWebsites;
    blockedWebsites.splice(index, 1);
    chrome.storage.local.set({ blockedWebsites }, () => updateBlockedList());
  });
}

function handleMessage(request: any): void {
  switch (request.action) {
    case "elementRemoved":
      isInspecting = false;
      updateInspectionState();
      updateDeletedList();
      break;
    case "contentScriptNotReady":
      alert("Something went wrong - please refresh the page and try again.");
      isInspecting = false;
      updateInspectionState();
      break;
    case "inspectionCanceled":
      isInspecting = false;
      updateInspectionState();
      break;
  }
}

function updateExtensionState(): void {
  chrome.storage.local.get({ extensionEnabled: true }, (result) => {
    if (elements.extensionToggle instanceof HTMLInputElement)
      elements.extensionToggle.checked = result.extensionEnabled;
    updateInspectionState();
  });
}

function initialize(): void {
  initializeElements();
  addEventListeners();
  if (elements.mainContent) showTab(elements.mainContent);
  updateBlockedList();
  updateDeletedList();
  updateExtensionState();
}

document.addEventListener("DOMContentLoaded", initialize);
document.querySelector<HTMLElement>("body")!.innerHTML = PopupPage;
