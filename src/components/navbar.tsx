import React from 'react';

interface NavbarProps {
  currentTab: 'main' | 'list' | 'presets';
  onTabChange: (tab: 'main' | 'list' | 'presets') => void;
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}

const Navbar: React.FC<NavbarProps> = ({ currentTab, onTabChange, isEnabled, onToggle }) => {
  return (
    <div id="navbar" className="navbar">
      <div className="left">
        <img src="../assets/icons/logo.svg" className="logo" alt="Logo" />
      </div>
      <div className="right">
        <div className="tabs-container">
          <ul className="tabs">
            <li className="tab">
              <a
                href="#"
                id="main-tab"
                className={`tab-link ${currentTab === 'main' ? 'selected-tab' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  onTabChange('main');
                }}
              >
                Main
              </a>
            </li>
            <li className="tab">
              <a
                href="#"
                id="list-tab"
                className={`tab-link ${currentTab === 'list' ? 'selected-tab' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  onTabChange('list');
                }}
              >
                Custom
              </a>
            </li>
            <li className="tab">
              <a
                href="#"
                id="presets-tab"
                className={`tab-link ${currentTab === 'presets' ? 'selected-tab' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  onTabChange('presets');
                }}
              >
                Presets
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="toggle-container">
        <label className="toggle-switch">
          <input
            type="checkbox"
            id="extension-toggle"
            checked={isEnabled}
            onChange={(e) => onToggle(e.target.checked)}
          />
          <span className="slider round"></span>
        </label>
      </div>
    </div>
  );
};

export default Navbar;
