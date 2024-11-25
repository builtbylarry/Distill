import PopupPage from "./popup.html?raw";
import "./popup.css";

const elementIds = {
  mainTab: "main-tab",
  listTab: "list-tab",
  presetsTab: "presets-tab",
  mainContent: "main-content",
  listContent: "list-content",
  presetsContent: "presets-content",
  inspectButton: "inspect-button",
  cancelButton: "cancel-button",
  deletedList: "deleted-list",
  websiteInput: "website-input",
  blockButton: "block-button",
  websiteSearch: "website-search",
  extensionToggle: "extension-toggle",
  disabledText: "disabled-text",
  navbar: "navbar",
  hr: "hr",
  body: "body",
  platformSelect: "platform-select",
  presetOptions: "preset-options",
  notificationsToggle: "notifications-toggle",
  subscriptionsToggle: "subscriptions-toggle",
  recommendationsToggle: "recommendations-toggle",
  commentsToggle: "comments-toggle",
} as const;

let isInspecting = false;
let isSelectOpen = false;
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
  elements.presetsTab?.addEventListener("click", (e) =>
    handleTabClick(e, elements.presetsContent)
  );
  elements.inspectButton?.addEventListener("click", startInspection);
  elements.cancelButton?.addEventListener("click", cancelInspection);
  elements.extensionToggle?.addEventListener("change", toggleExtension);
  elements.websiteSearch?.addEventListener("input", () => updateCombinedList());
  elements.blockButton?.addEventListener("click", blockWebsite);

  if (elements.platformSelect instanceof HTMLSelectElement) {
    const chevronIcon = document.querySelector(".preset-selector .chevron-icon");
    
    elements.platformSelect.addEventListener("click", () => {
      if (!isSelectOpen) {
        isSelectOpen = true;
        chevronIcon?.classList.add("rotated");
      }
    });

    elements.platformSelect.addEventListener("change", (event) => {
      isSelectOpen = false;
      chevronIcon?.classList.remove("rotated");
      handlePlatformChange(event);
    });

    document.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      if (!elements.platformSelect?.contains(target) && isSelectOpen) {
        isSelectOpen = false;
        chevronIcon?.classList.remove("rotated");
      }
    });

    elements.platformSelect.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isSelectOpen) {
        isSelectOpen = false;
        chevronIcon?.classList.remove("rotated");
      }
    });

    elements.platformSelect.addEventListener("blur", () => {
      if (!document.activeElement?.closest('.preset-selector')) {
        isSelectOpen = false;
        chevronIcon?.classList.remove("rotated");
      }
    });
  }

  elements.notificationsToggle?.addEventListener("change", handlePresetToggle);
  elements.subscriptionsToggle?.addEventListener("change", handlePresetToggle);
  elements.recommendationsToggle?.addEventListener("change", handlePresetToggle);
  elements.commentsToggle?.addEventListener("change", handlePresetToggle);

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
  [elements.mainContent, elements.listContent, elements.presetsContent].forEach(
    (content) => {
      content?.classList.toggle("hidden", content !== tabContent);
    }
  );
}

function updateTabSelection(selectedTab: HTMLElement): void {
  [elements.mainTab, elements.listTab, elements.presetsTab].forEach((tab) => {
    tab?.classList.toggle("selected-tab", tab === selectedTab);
  });
}

function handleTabSpecificActions(content: HTMLElement): void {
  if (content === elements.listContent) {
    if (elements.websiteSearch instanceof HTMLInputElement)
      elements.websiteSearch.value = "";
    updateCombinedList();
  } else if (content === elements.presetsContent) {
    loadSavedPresets();
  }
}

function handlePlatformChange(event: Event): void {
  const select = event.target as HTMLSelectElement;
  const platform = select.value;
  const presetOptions = elements.presetOptions;

  if (presetOptions) {
    if (platform) {
      presetOptions.classList.add("visible");
      loadPlatformPresets(platform);
    } else {
      presetOptions.classList.remove("visible");
    }
  }
}

function loadPlatformPresets(platform: string): void {
  chrome.storage.local.get({ platformPresets: {} }, (result) => {
    const presets = (result.platformPresets as PlatformPresets)[platform] || {
      notifications: false,
      subscriptions: false,
      recommendations: false,
      comments: false,
    };

    if (elements.notificationsToggle instanceof HTMLInputElement)
      elements.notificationsToggle.checked = presets.notifications;
    if (elements.subscriptionsToggle instanceof HTMLInputElement)
      elements.subscriptionsToggle.checked = presets.subscriptions;
    if (elements.recommendationsToggle instanceof HTMLInputElement)
      elements.recommendationsToggle.checked = presets.recommendations;
    if (elements.commentsToggle instanceof HTMLInputElement)
      elements.commentsToggle.checked = presets.comments;
  });
}

function handlePresetToggle(): void {
  const platformSelect = elements.platformSelect as HTMLSelectElement;
  const platform = platformSelect.value;

  if (!platform) return;

  const presets: PresetOptions = {
    notifications:
      elements.notificationsToggle instanceof HTMLInputElement
        ? elements.notificationsToggle.checked
        : false,
    subscriptions:
      elements.subscriptionsToggle instanceof HTMLInputElement
        ? elements.subscriptionsToggle.checked
        : false,
    recommendations:
      elements.recommendationsToggle instanceof HTMLInputElement
        ? elements.recommendationsToggle.checked
        : false,
    comments:
      elements.commentsToggle instanceof HTMLInputElement
        ? elements.commentsToggle.checked
        : false,
  };

  savePresets(platform, presets);
}

function savePresets(platform: string, presets: PresetOptions): void {
  chrome.storage.local.get({ platformPresets: {} }, (result) => {
    const platformPresets = result.platformPresets as PlatformPresets;
    platformPresets[platform] = presets;
    chrome.storage.local.set({ platformPresets }, () => {
      applyPresets(platform, presets);
    });
  });
}

function applyPresets(platform: string, presets: PresetOptions): void {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    if (currentTab?.id) {
      chrome.tabs.sendMessage(currentTab.id, {
        action: "applyPresets",
        platform,
        presets,
      });
    }
  });
}

function loadSavedPresets(): void {
  const platformSelect = elements.platformSelect as HTMLSelectElement;
  const platform = platformSelect.value;
  if (platform) {
    loadPlatformPresets(platform);
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
    updateInspectionState();
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
          updateCombinedList();
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

function updateCombinedList(searchTerm = ""): void {
  if (elements.websiteSearch instanceof HTMLInputElement) {
    searchTerm = elements.websiteSearch.value.trim();
  }

  chrome.storage.local.get({ removedElements: {}, blockedWebsites: [] }, (result) => {
    const removedElements: RemovedElements = result.removedElements;
    const blockedWebsites: string[] = result.blockedWebsites;
    
    if (elements.deletedList) elements.deletedList.innerHTML = "";

    const filteredElements = filterRemovedElements(removedElements, searchTerm);
    const filteredWebsites = filterBlockedWebsites(blockedWebsites, searchTerm);

    if (Object.keys(filteredElements).length === 0 && filteredWebsites.length === 0) {
      displayNoResultsMessage(searchTerm);
      return;
    }

    filteredWebsites.forEach((website, index) => {
      const websiteDiv = document.createElement("div");
      websiteDiv.innerHTML = createBlockedWebsiteHTML(website, index);
      elements.deletedList?.appendChild(websiteDiv);
    });

    displayFilteredElements(filteredElements);

    addRestoreButtonListeners();
    addEditButtonListeners();
    addUnblockButtonListeners();
    addDropdownListeners();
  });
}

function filterRemovedElements(
  removedElements: RemovedElements,
  searchTerm: string
): RemovedElements {
  const filteredElements: RemovedElements = {};
  Object.entries(removedElements).forEach(([hostname, elements]) => {
    const filteredHostElements = elements.filter(
      (el) =>
        !searchTerm ||
        hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        el.url.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (filteredHostElements.length > 0) {
      filteredElements[hostname] = filteredHostElements;
    }
  });
  return filteredElements;
}

function filterBlockedWebsites(blockedWebsites: string[], searchTerm: string): string[] {
  return blockedWebsites.filter(website => 
    !searchTerm || website.toLowerCase().includes(searchTerm.toLowerCase())
  );
}

function displayNoResultsMessage(searchTerm: string): void {
  if (elements.deletedList) {
    elements.deletedList.innerHTML = searchTerm
      ? "<p class='no-results-text'>No matching elements or websites found.</p>"
      : "<p class='no-results-text'>No elements or websites have been blocked yet.</p>";
  }
}

function displayFilteredElements(filteredElements: RemovedElements): void {
  Object.entries(filteredElements).forEach(([hostname, removedEls]) => {
    const hostnameDiv = createHostnameDiv(hostname, removedEls);
    elements.deletedList?.appendChild(hostnameDiv);
  });
}

function createHostnameDiv(
  hostname: string,
  removedEls: RemovedElement[]
): HTMLDivElement {
  const hostnameDiv = document.createElement("div");
  hostnameDiv.innerHTML = `
    <div class="removed-elements-list">
      <div class="website-header">
        <span class="website-name">${hostname}</span>
        <button class="dropdown-button">
          <img src="../assets/icons/chevron-down-solid.svg" alt="Toggle" class="chevron-icon">
        </button>
      </div>
      <div class="elements-container hidden">
        ${removedEls.map((el, index) => createRemovedElementHTML(el, index)).join("")}
      </div>
    </div>
  `;
  return hostnameDiv;
}

function createRemovedElementHTML(el: RemovedElement, index: number): string {
  return `
    <div class="removed-element-container">
      <div class="removed-element-name" data-url="${el.url}" data-index="${index}">
        ${el.tagName}${el.classes.length ? `.${el.classes.join(".")}` : ""}
      </div>
      <div class="element-actions">
        <button class="edit-button" data-url="${el.url}" data-index="${index}">
          <img src="../assets/icons/pen-to-square-solid.svg" alt="Edit" class="edit-icon">
        </button>
        <button class="restore-button" data-url="${el.url}" data-index="${index}">
          <img src="../assets/icons/trash-solid.svg" alt="Restore" class="trash-icon">
        </button>
      </div>
    </div>
  `;
}

function createBlockedWebsiteHTML(website: string, index: number): string {
  return `
    <div class="removed-elements-list">
      <div class="website-header">
        <span class="website-name">${website}</span>
        <button class="unblock-button" data-index="${index}">
          <img src="../assets/icons/trash-solid.svg" alt="Unblock" class="trash-icon">
        </button>
      </div>
    </div>
  `;
}

function addDropdownListeners(): void {
  elements.deletedList?.querySelectorAll(".removed-elements-list").forEach((list) => {
    const header = list.querySelector(".website-header");
    const elementsContainer = list.querySelector(".elements-container");
    const chevron = list.querySelector(".chevron-icon");
    
    if (header && elementsContainer && chevron) {
      header.addEventListener("click", (e: Event) => {
        const target = e.target as HTMLElement;
        if (!target.closest(".unblock-button") && !target.closest(".edit-button") && !target.closest(".restore-button")) {
          elementsContainer.classList.toggle("hidden");
          chevron.classList.toggle("rotated");
        }
      });
    }
  });
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

function addEditButtonListeners(): void {
  elements.deletedList?.querySelectorAll(".edit-button").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      const url = target.dataset.url;
      const index = parseInt(target.dataset.index || "");
      if (url && !isNaN(index)) {
        const container = target.closest(".removed-element-container");
        const nameElement = container?.querySelector(".removed-element-name");
        const restoreButton = container?.querySelector(".restore-button") as HTMLButtonElement | null;
        if (nameElement && container && restoreButton) {
          const currentName = nameElement.textContent?.trim() || "";
          const input = document.createElement("input");
          input.type = "text";
          input.value = currentName;
          input.className = "edit-name-input";
          
          const editButton = container.querySelector(".edit-button");
          if (editButton) {
            editButton.innerHTML = '<img src="../assets/icons/check-solid.svg" alt="Confirm" class="check-icon">';
            editButton.classList.add("confirm-edit");
          }
          
          const cancelButton = document.createElement("button");
          cancelButton.className = "cancel-edit-button";
          cancelButton.innerHTML = '<img src="../assets/icons/xmark-solid.svg" alt="Cancel" class="xmark-icon">';
          
          restoreButton.style.display = "none";
          
          const handleConfirm = () => {
            const newName = input.value.trim();
            if (newName) {
              updateElementName(url, index, newName);
            }
            nameElement.textContent = newName || currentName;
            if (editButton) {
              editButton.innerHTML = '<img src="../assets/icons/pen-to-square-solid.svg" alt="Edit" class="edit-icon">';
              editButton.classList.remove("confirm-edit");
            }
            restoreButton.style.display = "block";
            cancelButton.remove();
          };

          const handleCancel = () => {
            nameElement.textContent = currentName;
            if (editButton) {
              editButton.innerHTML = '<img src="../assets/icons/pen-to-square-solid.svg" alt="Edit" class="edit-icon">';
              editButton.classList.remove("confirm-edit");
            }
            restoreButton.style.display = "block";
            cancelButton.remove();
          };

          input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              handleConfirm();
            } else if (e.key === "Escape") {
              handleCancel();
            }
          });

          input.addEventListener("blur", () => {
            if (!editButton?.classList.contains("confirm-edit")) {
              handleCancel();
            }
          });

          if (editButton) {
            const existingListener = editButton.getAttribute("data-has-listener");
            if (!existingListener) {
              editButton.addEventListener("click", (e) => {
                if (editButton.classList.contains("confirm-edit")) {
                  e.stopPropagation();
                  handleConfirm();
                }
              });
              editButton.setAttribute("data-has-listener", "true");
            }
          }

          cancelButton.addEventListener("click", (e) => {
            e.stopPropagation();
            handleCancel();
          });

          nameElement.textContent = "";
          nameElement.appendChild(input);
          container.querySelector(".element-actions")?.insertBefore(
            cancelButton,
            editButton
          );
          input.focus();
          input.select();
        }
      }
    });
  });
}

function addUnblockButtonListeners(): void {
  elements.deletedList?.querySelectorAll(".unblock-button").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const index = parseInt(
        (e.currentTarget as HTMLButtonElement).dataset.index || ""
      );
      if (!isNaN(index)) unblockWebsite(index);
    });
  });
}

function updateElementName(url: string, index: number, newName: string): void {
  chrome.storage.local.get({ removedElements: {} }, (result) => {
    const removedElements: RemovedElements = result.removedElements;
    const hostname = new URL(url).hostname;
    
    if (removedElements[hostname] && removedElements[hostname][index]) {
      const element = removedElements[hostname][index];
      const nameParts = newName.split(".");
      element.tagName = nameParts[0];
      element.classes = nameParts.slice(1);

      chrome.storage.local.set({ removedElements }, () => {
        updateCombinedList(
          elements.websiteSearch instanceof HTMLInputElement
            ? elements.websiteSearch.value
            : ""
        );
      });
    }
  });
}

function restoreElement(url: string, index: number): void {
  chrome.storage.local.get({ removedElements: {} }, (result) => {
    const removedElements: RemovedElements = result.removedElements;
    const hostname = new URL(url).hostname;
    if (removedElements[hostname] && removedElements[hostname][index]) {
      const restoredElement = removedElements[hostname].splice(index, 1)[0];
      if (removedElements[hostname].length === 0)
        delete removedElements[hostname];

      chrome.storage.local.set({ removedElements }, () => {
        updateCombinedList(
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

function unblockWebsite(index: number): void {
  chrome.storage.local.get({ blockedWebsites: [] }, (result) => {
    const blockedWebsites: string[] = result.blockedWebsites;
    blockedWebsites.splice(index, 1);
    chrome.storage.local.set({ blockedWebsites }, () => {
      updateCombinedList(
        elements.websiteSearch instanceof HTMLInputElement
          ? elements.websiteSearch.value
          : ""
      );
    });
  });
}

function handleMessage(request: any): void {
  switch (request.action) {
    case "elementRemoved":
      isInspecting = false;
      updateInspectionState();
      updateCombinedList();
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
  updateCombinedList();
  updateExtensionState();
}

document.addEventListener("DOMContentLoaded", initialize);
document.querySelector<HTMLElement>("body")!.innerHTML = PopupPage;
