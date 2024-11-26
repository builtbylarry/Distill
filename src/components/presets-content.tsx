import React, { useState, useEffect } from "react";

interface PresetOptions {
  notifications: boolean;
  subscriptions: boolean;
  recommendations: boolean;
  comments: boolean;
}

interface PlatformPresets {
  [platform: string]: PresetOptions;
}

const PresetsContent: React.FC = () => {
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const [presets, setPresets] = useState<PresetOptions>({
    notifications: false,
    subscriptions: false,
    recommendations: false,
    comments: false,
  });

  useEffect(() => {
    if (selectedPlatform) {
      loadPlatformPresets(selectedPlatform);
    }
  }, [selectedPlatform]);

  const loadPlatformPresets = (platform: string) => {
    chrome.storage.local.get({ platformPresets: {} }, (result) => {
      const platformPresets = result.platformPresets as PlatformPresets;
      setPresets(
        platformPresets[platform] || {
          notifications: false,
          subscriptions: false,
          recommendations: false,
          comments: false,
        }
      );
    });
  };

  const handlePlatformChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const platform = event.target.value;
    setSelectedPlatform(platform);
    setIsSelectOpen(false);
  };

  const handlePresetToggle = (preset: keyof PresetOptions) => {
    if (!selectedPlatform) return;

    const updatedPresets = {
      ...presets,
      [preset]: !presets[preset],
    };

    setPresets(updatedPresets);
    savePresets(selectedPlatform, updatedPresets);
  };

  const savePresets = (platform: string, newPresets: PresetOptions) => {
    chrome.storage.local.get({ platformPresets: {} }, (result) => {
      const platformPresets = result.platformPresets as PlatformPresets;
      platformPresets[platform] = newPresets;
      chrome.storage.local.set({ platformPresets }, () => {
        applyPresets(platform, newPresets);
      });
    });
  };

  const applyPresets = async (platform: string, options: PresetOptions) => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id) return;

      chrome.tabs.sendMessage(tab.id, {
        action: "applyPresets",
        platform,
        presets: options,
      });
    } catch (error) {
      console.error("Error applying presets:", error);
      alert("Something went wrong. Please refresh the page and try again.");
    }
  };

  return (
    <div id="presets-content" className="presets-content">
      <div className="preset-selector">
        <select
          id="platform-select"
          className="platform-select"
          value={selectedPlatform}
          onChange={handlePlatformChange}
          onClick={() => setIsSelectOpen(true)}
          onBlur={() => {
            if (!document.activeElement?.closest(".preset-selector")) {
              setIsSelectOpen(false);
            }
          }}
        >
          <option value="" hidden>
            Select Platform
          </option>
          <option value="youtube">YouTube</option>
          <option value="facebook">Facebook</option>
          <option value="twitter">Twitter</option>
          <option value="reddit">Reddit</option>
        </select>
        <img
          src="../assets/icons/chevron-down-solid.svg"
          alt="Toggle"
          className={`chevron-icon ${isSelectOpen ? "rotated" : ""}`}
        />
      </div>

      <div className={`preset-options ${selectedPlatform ? "visible" : ""}`}>
        <div className="preset-option">
          <span>Notifications</span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              id="notifications-toggle"
              checked={presets.notifications}
              onChange={() => handlePresetToggle("notifications")}
            />
            <span className="slider round"></span>
          </label>
        </div>

        <div className="preset-option">
          <span>Subscriptions</span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              id="subscriptions-toggle"
              checked={presets.subscriptions}
              onChange={() => handlePresetToggle("subscriptions")}
            />
            <span className="slider round"></span>
          </label>
        </div>

        <div className="preset-option">
          <span>Recommendations</span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              id="recommendations-toggle"
              checked={presets.recommendations}
              onChange={() => handlePresetToggle("recommendations")}
            />
            <span className="slider round"></span>
          </label>
        </div>

        <div className="preset-option">
          <span>Comments</span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              id="comments-toggle"
              checked={presets.comments}
              onChange={() => handlePresetToggle("comments")}
            />
            <span className="slider round"></span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default PresetsContent;
