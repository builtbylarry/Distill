import React from 'react';

interface MainContentProps {
  isEnabled: boolean;
  isInspecting: boolean;
  setIsInspecting: (inspecting: boolean) => void;
}

const MainContent: React.FC<MainContentProps> = ({
  isEnabled,
  isInspecting,
  setIsInspecting,
}) => {
  const startInspection = () => {
    if (!isInspecting) {
      setIsInspecting(true);
      chrome.runtime.sendMessage({ action: "startInspection" });
    }
  };

  const cancelInspection = () => {
    if (isInspecting) {
      setIsInspecting(false);
      chrome.runtime.sendMessage({ action: "cancelInspection" });
    }
  };

  return (
    <div id="main-content" className="main-content">
      <p
        id="disabled-text"
        className="disabled-text"
        style={{ display: !isInspecting && !isEnabled ? 'flex' : 'none' }}
      >
        Distill is currently disabled.
        <br />
        Please re-enable the extension to block new elements.
      </p>
      
      {!isInspecting && isEnabled && (
        <button
          id="inspect-button"
          className="inspect-button"
          onClick={startInspection}
        >
          Remove Element
        </button>
      )}
      
      {isInspecting && (
        <button
          id="cancel-button"
          className="cancel-button"
          onClick={cancelInspection}
        >
          Cancel
        </button>
      )}
    </div>
  );
};

export default MainContent;
