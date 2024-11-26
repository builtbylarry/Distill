import React, { useEffect, useState } from 'react';
import './styles/popup.css';
import Navbar from './components/navbar';
import MainContent from './components/main-content';
import ListContent from './components/list-content';
import PresetsContent from './components/presets-content';

type Tab = 'main' | 'list' | 'presets';

const Popup: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<Tab>('main');
  const [isExtensionEnabled, setIsExtensionEnabled] = useState(true);
  const [isInspecting, setIsInspecting] = useState(false);

  useEffect(() => {
    chrome.storage.local.get({ extensionEnabled: true }, (result) => {
      setIsExtensionEnabled(result.extensionEnabled);
    });

    chrome.runtime.onMessage.addListener((request) => {
      switch (request.action) {
        case 'elementRemoved':
          setIsInspecting(false);
          break;
        case 'contentScriptNotReady':
          alert('Something went wrong - please refresh the page and try again.');
          setIsInspecting(false);
          break;
        case 'inspectionCanceled':
          setIsInspecting(false);
          break;
      }
    });
  }, []);

  const handleTabChange = (tab: Tab) => {
    setCurrentTab(tab);
  };

  const handleExtensionToggle = (enabled: boolean) => {
    setIsExtensionEnabled(enabled);
    chrome.storage.local.set({ extensionEnabled: enabled }, () => {
      chrome.runtime.sendMessage({ action: 'updateExtensionState', isEnabled: enabled });
    });
  };

  return (
    <div id="body" style={{ 
      height: isInspecting ? '50px' : '300px',
      width: isInspecting ? '50px' : '350px'
    }}>
      {!isInspecting && (
        <>
          <Navbar
            currentTab={currentTab}
            onTabChange={handleTabChange}
            isEnabled={isExtensionEnabled}
            onToggle={handleExtensionToggle}
          />
          <hr id="hr" />
        </>
      )}
      
      {currentTab === 'main' && (
        <MainContent
          isEnabled={isExtensionEnabled}
          isInspecting={isInspecting}
          setIsInspecting={setIsInspecting}
        />
      )}
      {currentTab === 'list' && <ListContent />}
      {currentTab === 'presets' && <PresetsContent />}
    </div>
  );
};

export default Popup;

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('root');
  if (root) {
    import('react-dom/client').then(({ createRoot }) => {
      createRoot(root).render(
        <React.StrictMode>
          <Popup />
        </React.StrictMode>
      );
    });
  }
});
