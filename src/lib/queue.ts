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

export const playDingDong = (): Promise<void> => {
  return new Promise((resolve) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = ctx.currentTime;

      // Ding (higher note)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.value = 830; // ~G#5
      gain1.gain.setValueAtTime(0.5, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.6);

      // Dong (lower note)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.value = 622; // ~Eb5
      gain2.gain.setValueAtTime(0.5, now + 0.35);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.35);
      osc2.stop(now + 1.0);

      setTimeout(() => {
        ctx.close();
        resolve();
      }, 1100);
    } catch {
      resolve();
    }
  });
};

export const speak = (text: string, withChime = false) => {
  const doSpeak = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.85;
      utterance.pitch = 1;
      utterance.volume = 1;
      window.speechSynthesis.speak(utterance);
    }
  };

  if (withChime) {
    playDingDong().then(doSpeak);
  } else {
    doSpeak();
  }
};
