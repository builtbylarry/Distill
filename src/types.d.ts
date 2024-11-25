type ElementId = keyof typeof elementIds;
type Elements = Record<ElementId, HTMLElement | null>;

interface RemovedElement {
  tagName: string;
  classes: string[];
  url: string;
}

interface RemovedElements {
  [hostname: string]: RemovedElement[];
}

interface ElementInfo {
  tagName: string;
  id: string;
  classes: string[];
  xpath: string;
  innerHTML: string;
  url: string;
}

interface PresetOptions {
  notifications: boolean;
  subscriptions: boolean;
  recommendations: boolean;
  comments: boolean;
}

interface PlatformPresets {
  [platform: string]: PresetOptions;
}
