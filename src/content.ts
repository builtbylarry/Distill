interface ElementInfo {
  tagName: string;
  id: string;
  classes: string[];
  xpath: string;
  innerHTML: string;
}

let isExtensionEnabled = true;
let isInspecting = false;
let overlay: HTMLDivElement | null = null;
let highlightedElement: HTMLElement | null = null;
let removedElementsSelectors: string[] = [];

function stopInspection(): void {
  if (!isInspecting) return;

  isInspecting = false;
  removeOverlay();
  resetHighlightedElement();
  removeEventListeners();
  chrome.runtime.sendMessage({ action: "inspectionCanceled" });
}

function startInspection(): void {
  if (isInspecting) return;

  isInspecting = true;
  createOverlay();
  addEventListeners();
  chrome.runtime.sendMessage({ action: "inspectionStarted" });
}

function createOverlay(): void {
  overlay = document.createElement("div");
  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: "2147483647",
    pointerEvents: "none",
  });
  document.body.appendChild(overlay);
}

function removeOverlay(): void {
  overlay?.remove();
  overlay = null;
}

function handleMouseMove(event: MouseEvent): void {
  if (!isInspecting) return;

  const target = event.target as HTMLElement;
  resetHighlightedElement();

  highlightedElement = target;
  highlightElement(highlightedElement);
  updateOverlayClipPath(target);
}

function handleClick(event: MouseEvent): void {
  if (!isInspecting) return;

  event.preventDefault();
  event.stopPropagation();

  const selectedElement = event.target as HTMLElement;
  const elementInfo = {
    tagName: selectedElement.tagName,
    id: selectedElement.id,
    classes: Array.from(selectedElement.classList),
    xpath: getXPath(selectedElement),
    innerHTML: selectedElement.innerHTML,
  };

  selectedElement.remove();
  chrome.runtime.sendMessage({ action: "elementRemoved", data: elementInfo });
  stopInspection();
}

function handleKeyDown(event: KeyboardEvent): void {
  if (event.key === "Escape") stopInspection();
}

function resetHighlightedElement(): void {
  if (highlightedElement) {
    highlightedElement.style.outline = "";
    highlightedElement = null;
  }
}

function highlightElement(element: HTMLElement): void {
  element.style.outline = "2px solid red";
  element.style.outlineOffset = "-2px";
}

function updateOverlayClipPath(target: HTMLElement): void {
  if (!overlay) return;

  const rect = target.getBoundingClientRect();
  overlay.style.boxShadow = `0 0 0 100vmax rgba(0, 0, 0, 0.5)`;
  overlay.style.clipPath = `polygon(
      0% 0%,
      0% 100%,
      ${rect.left}px 100%,
      ${rect.left}px ${rect.top}px,
      ${rect.right}px ${rect.top}px,
      ${rect.right}px ${rect.bottom}px,
      ${rect.left}px ${rect.bottom}px,
      ${rect.left}px 100%,
      100% 100%,
      100% 0%
  )`;
}

function getXPath(element: HTMLElement): string {
  if (element.id !== "") return 'id("' + element.id + '")';
  if (element === document.body) return element.tagName;

  let ix = 0;
  const siblings = element.parentNode?.childNodes || [];
  for (let i = 0; i < siblings.length; i++) {
    const sibling = siblings[i] as HTMLElement;
    if (sibling === element)
      return `${getXPath(element.parentNode as HTMLElement)}/${
        element.tagName
      }[${ix + 1}]`;
    if (sibling.nodeType === 1 && sibling.tagName === element.tagName) ix++;
  }
  return "";
}

function addEventListeners(): void {
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("click", handleClick, true);
  document.addEventListener("keydown", handleKeyDown);
}

function removeEventListeners(): void {
  document.removeEventListener("mousemove", handleMouseMove);
  document.removeEventListener("click", handleClick, true);
  document.removeEventListener("keydown", handleKeyDown);
}

function hideElement(elementInfo: ElementInfo): void {
  const selector = getElementSelector(elementInfo);
  if (!removedElementsSelectors.includes(selector)) {
    removedElementsSelectors.push(selector);
  }
  applyStyles();
}

function getElementSelector(elementInfo: ElementInfo): string {
  if (elementInfo.id) return `#${elementInfo.id}`;
  if (elementInfo.classes && elementInfo.classes.length) {
    return `${elementInfo.tagName.toLowerCase()}.${elementInfo.classes.join(
      "."
    )}`;
  }
  return elementInfo.xpath;
}

function applyStyles(): void {
  let style = document.getElementById("distill-styles") as HTMLStyleElement;
  if (!style) {
    style = document.createElement("style");
    style.id = "distill-styles";
    document.head.appendChild(style);
  }
  style.textContent = removedElementsSelectors
    .map((selector) => `${selector} { display: none !important; }`)
    .join("\n");
}

function hideStoredElements(): void {
  if (!isExtensionEnabled) return;

  chrome.storage.local.get({ removedElements: {} }, (result) => {
    const removedElements = result.removedElements[window.location.href] || [];
    removedElements.forEach(hideElement);
  });
}

function restoreAllElements(): void {
  chrome.storage.local.get({ removedElements: {} }, (result) => {
    const removedElements = result.removedElements[window.location.href] || [];
    removedElements.forEach(restoreElement);
  });
}

function restoreElement(elementInfo: ElementInfo): void {
  let element = findElement(elementInfo);

  if (element instanceof HTMLElement) {
    element.style.display = "";
  } else {
    element = createNewElement(elementInfo);
    insertElement(element, elementInfo);
  }
}

function findElement(elementInfo: ElementInfo): HTMLElement | null {
  if (elementInfo.id) return document.getElementById(elementInfo.id);
  if (elementInfo.xpath) {
    return document.evaluate(
      elementInfo.xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue as HTMLElement | null;
  }
  return null;
}

function createNewElement(elementInfo: ElementInfo): HTMLElement {
  const element = document.createElement(elementInfo.tagName);
  if (elementInfo.id) element.id = elementInfo.id;
  element.className = elementInfo.classes.join(" ");
  element.innerHTML = elementInfo.innerHTML;
  return element;
}

function insertElement(element: HTMLElement, elementInfo: ElementInfo): void {
  const parent = findParentElement(elementInfo);
  if (parent) {
    parent.appendChild(element);
  } else {
    document.body.appendChild(element);
  }
}

function findParentElement(elementInfo: ElementInfo): HTMLElement | null {
  const parentXPath = elementInfo.xpath.substring(
    0,
    elementInfo.xpath.lastIndexOf("/")
  );
  return document.evaluate(
    parentXPath,
    document,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  ).singleNodeValue as HTMLElement | null;
}

function observePageChanges(): void {
  const observer = new MutationObserver(applyStyles);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

chrome.runtime.onMessage.addListener((request, _, sendResponse) => {
  switch (request.action) {
    case "ping":
      sendResponse({ status: "ready" });
      break;
    case "startInspection":
      startInspection();
      break;
    case "cancelInspection":
      stopInspection();
      break;
    case "restoreElement":
      restoreElement(request.data);
      break;
    case "updateExtensionState":
      isExtensionEnabled = request.isEnabled;
      if (isExtensionEnabled) {
        hideStoredElements();
      } else {
        restoreAllElements();
      }
      break;
  }
});

chrome.storage.local.get(
  { extensionEnabled: true, removedElements: {} },
  (result) => {
    isExtensionEnabled = result.extensionEnabled;
    if (isExtensionEnabled) {
      hideStoredElements();
      observePageChanges();
    }
  }
);

if (document.readyState === "complete") {
  hideStoredElements();
  observePageChanges();
} else {
  window.addEventListener("load", () => {
    hideStoredElements();
    observePageChanges();
  });
}
