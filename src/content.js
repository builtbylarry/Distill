let isExtensionEnabled = true;
let isInspecting = false;
let overlay;
let highlightedElement;
let removedElementsSelectors = [];

function stopInspection() {
  if (isInspecting) {
    isInspecting = false;
    removeOverlay();
    if (highlightedElement) {
      highlightedElement.style.outline = "";
      highlightedElement = null;
    }
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("click", handleClick, true);
    document.removeEventListener("keydown", handleKeyDown);
    chrome.runtime.sendMessage({ action: "inspectionCanceled" });
  }
}

function startInspection() {
  if (!isInspecting) {
    isInspecting = true;
    createOverlay();
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("click", handleClick, true);
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
  overlay.style.zIndex = "2147483647"; // Max z-index
  overlay.style.pointerEvents = "none";
  document.body.appendChild(overlay);
}

function removeOverlay() {
  if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  overlay = null;
}

function handleMouseMove(event) {
  if (!isInspecting) return;

  const target = event.target;
  if (highlightedElement) highlightedElement.style.outline = "";

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
  if (event.key === "Escape") stopInspection();
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

function observeForElement(elementInfo) {
  const observer = new MutationObserver((mutations, obs) => {
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
      element.style.display = "none";
      obs.disconnect();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function getUniqueSelector(element) {
  if (element.id) return "#" + element.id;
  if (element.hasAttribute("data-testid"))
    return `[data-testid="${element.getAttribute("data-testid")}"]`;

  let path = [];

  while (element.nodeType === Node.ELEMENT_NODE) {
    let selector = element.nodeName.toLowerCase();
    if (element.className)
      selector += "." + element.className.replace(/\s+/g, ".");
    path.unshift(selector);
    element = element.parentNode;
  }

  return path.join(" > ");
}

function hideElement(elementInfo) {
  let selector;
  if (elementInfo.id) {
    selector = `#${elementInfo.id}`;
  } else if (elementInfo.classes && elementInfo.classes.length) {
    selector =
      elementInfo.tagName.toLowerCase() + "." + elementInfo.classes.join(".");
  } else {
    selector = elementInfo.xpath;
  }

  if (!removedElementsSelectors.includes(selector))
    removedElementsSelectors.push(selector);

  applyStyles();
}

function applyStyles() {
  let style = document.getElementById("distill-styles");
  if (!style) {
    style = document.createElement("style");
    style.id = "distill-styles";
    document.head.appendChild(style);
  }

  style.textContent = removedElementsSelectors
    .map((selector) => `${selector} { display: none !important; }`)
    .join("\n");
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
    xpath: getUniqueSelector(selectedElement),
  };

  hideElement(elementInfo);
  chrome.runtime.sendMessage({ action: "elementRemoved", data: elementInfo });
  stopInspection();
}

function hideStoredElements() {
  if (!isExtensionEnabled) return;

  chrome.storage.local.get({ removedElements: {} }, function (result) {
    let removedElements = result.removedElements[window.location.href] || [];
    removedElements.forEach(function (elementInfo) {
      hideElement(elementInfo);
    });
  });
}

function restoreAllElements() {
  chrome.storage.local.get({ removedElements: {} }, function (result) {
    let removedElements = result.removedElements[window.location.href] || [];
    removedElements.forEach(function (elementInfo) {
      restoreElement(elementInfo);
    });
  });
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

  if (element) {
    element.style.display = "";
  } else {
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
  }
}

function observePageChanges() {
  const observer = new MutationObserver((mutations) => {
    applyStyles();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function observePageChanges() {
  const observer = new MutationObserver((mutations) => {
    hideStoredElements();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
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
  function (result) {
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
