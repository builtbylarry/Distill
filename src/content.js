let isSelectingElement = false;

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "startElementRemoval") {
    isSelectingElement = true;
    document.body.style.cursor = "crosshair";
    document.addEventListener("click", clickHandler);
    document.addEventListener("mouseover", mouseoverHandler);
    document.addEventListener("mouseout", mouseoutHandler);
  }
});

function clickHandler(event) {
  if (!isSelectingElement) return;

  event.preventDefault();
  event.stopPropagation();

  const selectedElement = event.target;

  const elementInfo = {
    tagName: selectedElement.tagName,
    id: selectedElement.id,
    classes: Array.from(selectedElement.classList),
    xpath: getXPath(selectedElement),
  };

  selectedElement.remove();
  chrome.runtime.sendMessage({ action: "elementRemoved", data: elementInfo });
  stopSelectingElement();
}

function mouseoverHandler(event) {
  if (!isSelectingElement) return;
  event.target.style.outline = "2px solid red";
}

function mouseoutHandler(event) {
  if (!isSelectingElement) return;
  event.target.style.outline = "";
}

function stopSelectingElement() {
  isSelectingElement = false;
  document.body.style.cursor = "default";
  document.removeEventListener("click", clickHandler);
  document.removeEventListener("mouseover", mouseoverHandler);
  document.removeEventListener("mouseout", mouseoutHandler);
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

hideStoredElements();
