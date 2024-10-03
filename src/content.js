let isInspecting = false;
let overlay;
let highlightedElement;

function stopInspection() {
  if (isInspecting) {
    isInspecting = false;
    removeOverlay();
    if (highlightedElement) {
      highlightedElement.style.outline = "";
      highlightedElement = null;
    }
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("click", handleClick);
    document.removeEventListener("keydown", handleKeyDown);
    chrome.runtime.sendMessage({ action: "inspectionCanceled" });
  }
}

function startInspection() {
  if (!isInspecting) {
    isInspecting = true;
    createOverlay();
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    chrome.runtime.sendMessage({ action: "inspectionStarted" });
  }
}

function createOverlay() {
  overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
  overlay.style.zIndex = "2147483647";
  overlay.style.pointerEvents = "none";
  document.body.appendChild(overlay);
}

function removeOverlay() {
  if (overlay && overlay.parentNode) {
    overlay.parentNode.removeChild(overlay);
  }

  overlay = null;
}

function handleMouseMove(event) {
  if (!isInspecting) return;

  const target = event.target;

  if (highlightedElement) {
    highlightedElement.style.outline = "";
  }

  highlightedElement = target;
  highlightedElement.style.outline = "2px solid red";
  highlightedElement.style.outlineOffset = "-2px";

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

function handleClick(event) {
  if (!isInspecting) return;

  event.preventDefault();
  event.stopPropagation();

  const selectedElement = event.target;

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

function handleKeyDown(event) {
  if (event.key === "Escape") {
    stopInspection();
  }
}

function getXPath(element) {
  if (element.id !== "") return 'id("' + element.id + '")';
  if (element === document.body) return element.tagName;

  let ix = 0;
  let siblings = element.parentNode.childNodes;
  for (let i = 0; i < siblings.length; i++) {
    let sibling = siblings[i];
    if (sibling === element)
      return (
        getXPath(element.parentNode) +
        "/" +
        element.tagName +
        "[" +
        (ix + 1) +
        "]"
      );
    if (sibling.nodeType === 1 && sibling.tagName === element.tagName) ix++;
  }
}

function restoreElement(elementInfo) {
  let element;
  if (elementInfo.id) {
    element = document.getElementById(elementInfo.id);
  } else if (elementInfo.xpath) {
    element = document.evaluate(
      elementInfo.xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;
  }

  if (!element) {
    // If the element doesn't exist, create a new one
    element = document.createElement(elementInfo.tagName);
    if (elementInfo.id) element.id = elementInfo.id;
    element.className = elementInfo.classes.join(" ");
    element.innerHTML = elementInfo.innerHTML;

    // Try to insert the element at its original position using XPath
    let parent = document.evaluate(
      elementInfo.xpath.substring(0, elementInfo.xpath.lastIndexOf("/")),
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;
    if (parent) {
      parent.appendChild(element);
    } else {
      // If we can't find the original parent, append to body
      document.body.appendChild(element);
    }
  } else {
    // If the element exists, just make it visible again
    element.style.display = "";
  }
}

function hideStoredElements() {
  chrome.storage.local.get({ removedElements: {} }, function (result) {
    let removedElements = result.removedElements[window.location.href] || [];
    removedElements.forEach(function (elementInfo) {
      let element;
      if (elementInfo.id) {
        element = document.getElementById(elementInfo.id);
      } else if (elementInfo.xpath) {
        element = document.evaluate(
          elementInfo.xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        ).singleNodeValue;
      }
      if (element) {
        element.remove();
      }
    });
  });
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "ping") {
    sendResponse({ status: "ready" });
  } else if (request.action === "startInspection") {
    startInspection();
  } else if (request.action === "cancelInspection") {
    stopInspection();
  } else if (request.action === "restoreElement") {
    restoreElement(request.data);
  }

  return true;
});

hideStoredElements();
