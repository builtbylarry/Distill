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
