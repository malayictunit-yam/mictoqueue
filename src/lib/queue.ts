export const CATEGORIES = [
  { key: 'WP', label: 'Working Permit', window: 1, description: 'Employment & work authorization' },
  { key: 'BP', label: 'Business Permit', window: 2, description: 'Business registration & licensing' },
  { key: 'SP', label: 'Special Permit', window: 3, description: 'Special permits & exemptions' },
  { key: 'ATO', label: 'Authority to Operate', window: 4, description: 'Operational authority & compliance' },
] as const;

export type CategoryKey = typeof CATEGORIES[number]['key'];

export const getCategoryByWindow = (windowId: number) =>
  CATEGORIES.find(c => c.window === windowId)!;

export const getWindowColor = (windowId: number) => {
  const map: Record<number, string> = {
    1: 'bg-window-1',
    2: 'bg-window-2',
    3: 'bg-window-3',
    4: 'bg-window-4',
  };
  return map[windowId] || 'bg-primary';
};

export const getWindowTextColor = (windowId: number) => {
  const map: Record<number, string> = {
    1: 'text-window-1',
    2: 'text-window-2',
    3: 'text-window-3',
    4: 'text-window-4',
  };
  return map[windowId] || 'text-primary';
};

export const getWindowBorderColor = (windowId: number) => {
  const map: Record<number, string> = {
    1: 'border-window-1',
    2: 'border-window-2',
    3: 'border-window-3',
    4: 'border-window-4',
  };
  return map[windowId] || 'border-primary';
};

export const speak = (text: string) => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.85;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  }
};
