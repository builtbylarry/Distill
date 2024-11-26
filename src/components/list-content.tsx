import React, { useState, useEffect } from 'react';

interface RemovedElement {
  tagName: string;
  classes: string[];
  url: string;
}

interface RemovedElements {
  [hostname: string]: RemovedElement[];
}

const ListContent: React.FC = () => {
  const [websiteInput, setWebsiteInput] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [removedElements, setRemovedElements] = useState<RemovedElements>({});
  const [blockedWebsites, setBlockedWebsites] = useState<string[]>([]);
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());
  const [editingElement, setEditingElement] = useState<{hostname: string, index: number} | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    updateCombinedList();
  }, [searchInput]);

  const updateCombinedList = () => {
    chrome.storage.local.get(
      { removedElements: {}, blockedWebsites: [] },
      (result) => {
        setRemovedElements(filterRemovedElements(result.removedElements));
        setBlockedWebsites(filterBlockedWebsites(result.blockedWebsites));
      }
    );
  };

  const filterRemovedElements = (elements: RemovedElements): RemovedElements => {
    if (!searchInput) return elements;
    
    const filtered: RemovedElements = {};
    Object.entries(elements).forEach(([hostname, elements]) => {
      const filteredElements = elements.filter(
        (el) =>
          hostname.toLowerCase().includes(searchInput.toLowerCase()) ||
          el.url.toLowerCase().includes(searchInput.toLowerCase())
      );
      if (filteredElements.length > 0) {
        filtered[hostname] = filteredElements;
      }
    });
    return filtered;
  };

  const filterBlockedWebsites = (websites: string[]): string[] => {
    if (!searchInput) return websites;
    return websites.filter(website =>
      website.toLowerCase().includes(searchInput.toLowerCase())
    );
  };

  const blockWebsite = () => {
    const website = websiteInput.trim();
    if (website) {
      chrome.storage.local.get({ blockedWebsites: [] }, (result) => {
        const updatedWebsites = [...result.blockedWebsites];
        if (!updatedWebsites.includes(website)) {
          updatedWebsites.push(website);
          chrome.storage.local.set({ blockedWebsites: updatedWebsites }, () => {
            setWebsiteInput('');
            updateCombinedList();
          });
        }
      });
    }
  };

  const unblockWebsite = (index: number) => {
    chrome.storage.local.get({ blockedWebsites: [] }, (result) => {
      const updatedWebsites = [...result.blockedWebsites];
      updatedWebsites.splice(index, 1);
      chrome.storage.local.set({ blockedWebsites: updatedWebsites }, () => {
        updateCombinedList();
      });
    });
  };

  const startEditing = (hostname: string, index: number, currentName: string) => {
    setEditingElement({ hostname, index });
    setEditValue(currentName);
  };

  const saveEdit = () => {
    if (!editingElement) return;

    chrome.storage.local.get({ removedElements: {} }, (result) => {
      const updatedElements = { ...result.removedElements };
      const { hostname, index } = editingElement;
      
      if (updatedElements[hostname] && updatedElements[hostname][index]) {
        const element = updatedElements[hostname][index];
        const newClasses = editValue.split('.');
        const newTagName = newClasses.shift() || element.tagName;
        
        updatedElements[hostname][index] = {
          ...element,
          tagName: newTagName,
          classes: newClasses
        };

        chrome.storage.local.set({ removedElements: updatedElements }, () => {
          updateCombinedList();
          setEditingElement(null);
          setEditValue('');
        });
      }
    });
  };

  const cancelEdit = () => {
    setEditingElement(null);
    setEditValue('');
  };

  const restoreElement = (url: string, index: number) => {
    chrome.storage.local.get({ removedElements: {} }, (result) => {
      const updatedElements = { ...result.removedElements };
      const hostname = new URL(url).hostname;
      
      if (updatedElements[hostname] && updatedElements[hostname][index]) {
        const restoredElement = updatedElements[hostname].splice(index, 1)[0];
        if (updatedElements[hostname].length === 0) {
          delete updatedElements[hostname];
        }

        chrome.storage.local.set({ removedElements: updatedElements }, () => {
          updateCombinedList();
          sendRestoreMessageToTab(url, restoredElement);
        });
      }
    });
  };

  const sendRestoreMessageToTab = (url: string, element: RemovedElement) => {
    chrome.tabs.query({ url }, (tabs) => {
      if (tabs.length > 0 && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "restoreElement",
          data: element,
        });
      }
    });
  };

  const toggleSiteExpansion = (hostname: string) => {
    setExpandedSites(prev => {
      const newSet = new Set(prev);
      if (newSet.has(hostname)) {
        newSet.delete(hostname);
      } else {
        newSet.add(hostname);
      }
      return newSet;
    });
  };

  return (
    <div id="list-content" className="list-content">
      <div className="input-website-container">
        <input
          type="text"
          id="website-input"
          className="input website-input"
          placeholder="Enter website URL to block"
          value={websiteInput}
          onChange={(e) => setWebsiteInput(e.target.value)}
        />
        <button
          id="block-button"
          className="block-button"
          onClick={blockWebsite}
        >
          Block
        </button>
      </div>
      
      <input
        type="text"
        id="website-search"
        placeholder="Search elements & blocked sites..."
        className="input search-input"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
      />

      <div id="deleted-list" className="removed-elements-list-container">
        {blockedWebsites.length === 0 && Object.keys(removedElements).length === 0 ? (
          <p className="no-results-text">
            {searchInput
              ? "No matching elements or websites found."
              : "No elements or websites have been blocked yet."}
          </p>
        ) : (
          <>
            {blockedWebsites.map((website, index) => (
              <div key={website} className="removed-elements-list">
                <div className="website-header">
                  <span className="website-name">{website}</span>
                  <button
                    className="unblock-button"
                    onClick={() => unblockWebsite(index)}
                  >
                    <img
                      src="../assets/icons/trash-solid.svg"
                      alt="Unblock"
                      className="trash-icon"
                    />
                  </button>
                </div>
              </div>
            ))}

            {Object.entries(removedElements).map(([hostname, elements]) => (
              <div key={hostname} className="removed-elements-list">
                <div
                  className="website-header"
                  onClick={() => toggleSiteExpansion(hostname)}
                >
                  <span className="website-name">{hostname}</span>
                  <button className="dropdown-button">
                    <img
                      src="../assets/icons/chevron-down-solid.svg"
                      alt="Toggle"
                      className={`chevron-icon ${expandedSites.has(hostname) ? 'rotated' : ''}`}
                    />
                  </button>
                </div>
                <div className={`elements-container ${expandedSites.has(hostname) ? '' : 'hidden'}`}>
                  {elements.map((element, index) => (
                    <div key={index} className="removed-element-container">
                      {editingElement?.hostname === hostname && editingElement?.index === index ? (
                        <div className="edit-element-container">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="edit-element-input"
                            autoFocus
                          />
                          <div className="edit-actions">
                            <button onClick={saveEdit} className="save-button">
                              <img
                                src="../assets/icons/check-solid.svg"
                                alt="Save"
                                className="check-icon"
                              />
                            </button>
                            <button onClick={cancelEdit} className="cancel-button">
                              <img
                                src="../assets/icons/xmark-solid.svg"
                                alt="Cancel"
                                className="xmark-icon"
                              />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="removed-element-name">
                            {element.tagName}
                            {element.classes.length ? `.${element.classes.join('.')}` : ''}
                          </div>
                          <div className="element-actions">
                            <button
                              className="edit-button"
                              onClick={() => startEditing(
                                hostname,
                                index,
                                `${element.tagName}${element.classes.length ? `.${element.classes.join('.')}` : ''}`
                              )}
                            >
                              <img
                                src="../assets/icons/pen-to-square-solid.svg"
                                alt="Edit"
                                className="edit-icon"
                              />
                            </button>
                            <button
                              className="restore-button"
                              onClick={() => restoreElement(element.url, index)}
                            >
                              <img
                                src="../assets/icons/trash-solid.svg"
                                alt="Restore"
                                className="trash-icon"
                              />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default ListContent;
