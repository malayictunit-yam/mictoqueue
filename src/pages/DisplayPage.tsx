import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CATEGORIES, getWindowColor, getWindowTextColor, speak } from '@/lib/queue';

interface WindowStatus {
  windowId: number;
  category: string;
  label: string;
  customLabel: string;
  serving: string | null;
  waiting: string[];
}

interface DisplaySettings {
  department_name: string;
  logo_url: string | null;
  ticker_text: string;
}

interface Ad {
  type: string;
  file_url: string;
}

// Isolated media component — never re-renders on queue updates
const MediaPanel = memo(({ ad }: { ad: Ad | null }) => {
  if (!ad) {
    return (
      <div className="h-full flex items-center justify-center bg-card/5">
        <p className="text-primary-foreground/20 text-sm">No advertisement</p>
      </div>
    );
  }

  if (ad.type === 'video') {
    return (
      <video
        key={ad.file_url}
        src={ad.file_url}
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-full object-contain bg-black"
      />
    );
  }

  return (
    <img
      src={ad.file_url}
      alt="Advertisement"
      className="w-full h-full object-contain bg-black"
    />
  );
});
MediaPanel.displayName = 'MediaPanel';

const DisplayPage = () => {
  const [windows, setWindows] = useState<WindowStatus[]>([]);
  const [settings, setSettings] = useState<DisplaySettings | null>(null);
  const [activeAd, setActiveAd] = useState<Ad | null>(null);
  const prevServingRef = useRef<Record<number, string | null>>({});

  const fetchSettings = useCallback(async () => {
    const [{ data: s }, { data: ad }, { data: wl }] = await Promise.all([
      supabase.from('display_settings').select('*').limit(1).single(),
      supabase.from('ads').select('type, file_url').eq('is_active', true).limit(1).single(),
      supabase.from('window_labels').select('*').order('window_id'),
    ]);
    if (s) setSettings(s);
    setActiveAd(ad || null);
    return wl || [];
  }, []);

  const fetchQueue = useCallback(async (windowLabels?: { window_id: number; label: string }[]) => {
    const { data: tickets } = await supabase
      .from('tickets')
      .select('*')
      .in('status', ['serving', 'waiting'])
      .order('number', { ascending: true });

    const statuses = CATEGORIES.map(cat => {
      const catTickets = tickets?.filter(t => t.category === cat.key) || [];
      const servingTicket = catTickets.find(t => t.status === 'serving');
      const waitingTickets = catTickets.filter(t => t.status === 'waiting');
      const wl = windowLabels?.find(w => w.window_id === cat.window);
      return {
        windowId: cat.window,
        category: cat.key,
        label: cat.label,
        customLabel: wl?.label || `Window ${cat.window}`,
        serving: servingTicket?.ticket_number || null,
        waiting: waitingTickets.map(t => t.ticket_number),
      };
    });

    // TTS for newly serving tickets
    statuses.forEach(s => {
      const prev = prevServingRef.current[s.windowId];
      if (s.serving && s.serving !== prev) {
        speak(`Now serving ${s.serving.replace('-', ' ')} at ${s.customLabel}`);
      }
    });
    prevServingRef.current = Object.fromEntries(statuses.map(s => [s.windowId, s.serving]));
    setWindows(statuses);
  }, []);

  useEffect(() => {
    let windowLabelsCache: { window_id: number; label: string }[] = [];

    const init = async () => {
      const wl = await fetchSettings();
      windowLabelsCache = wl;
      await fetchQueue(wl);
    };
    init();

    // Only ticket changes trigger queue refetch — NOT full page re-render
    const ticketChannel = supabase
      .channel('display-tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        fetchQueue(windowLabelsCache);
      })
      .subscribe();

    // Settings/ads changes are infrequent
    const settingsChannel = supabase
      .channel('display-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'display_settings' }, () => fetchSettings())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ads' }, async () => {
        const { data: ad } = await supabase.from('ads').select('type, file_url').eq('is_active', true).limit(1).single();
        setActiveAd(ad || null);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'window_labels' }, async () => {
        const { data: wl } = await supabase.from('window_labels').select('*').order('window_id');
        if (wl) {
          windowLabelsCache = wl;
          fetchQueue(wl);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ticketChannel);
      supabase.removeChannel(settingsChannel);
    };
  }, [fetchQueue, fetchSettings]);

  return (
    <div className="h-screen bg-foreground flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-3 bg-card/10 border-b border-primary-foreground/10 flex-shrink-0">
        {settings?.logo_url && (
          <img src={settings.logo_url} alt="Logo" className="h-12 w-auto object-contain" />
        )}
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-primary-foreground tracking-tight leading-tight">
            {settings?.department_name || 'Government Services'}
          </h1>
          <p className="text-primary-foreground/40 text-[10px] uppercase tracking-widest">Queue Display</p>
        </div>
      </header>

      {/* Main: 2-column layout */}
      <div className="flex-1 flex min-h-0">
        {/* LEFT — Queue Display */}
        <div className="flex-1 p-4 md:p-6 overflow-auto">
          <p className="text-xs text-primary-foreground/40 uppercase tracking-widest font-medium mb-4">Now Serving</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {windows.map((w, i) => (
              <div
                key={w.windowId}
                className="rounded-xl overflow-hidden bg-card/5 border border-primary-foreground/10"
              >
                {/* Window header */}
                <div className={`${getWindowColor(w.windowId)} px-4 py-3 flex items-center justify-between`}>
                  <div>
                    <p className="text-[10px] font-semibold text-primary-foreground/70 uppercase tracking-wider">
                      {w.customLabel}
                    </p>
                    <p className="text-xs font-medium text-primary-foreground/80">{w.label}</p>
                  </div>
                  <span className="text-[10px] font-medium bg-primary-foreground/20 text-primary-foreground px-2 py-0.5 rounded">
                    {w.category}
                  </span>
                </div>

                {/* Serving number */}
                <div className="p-5 md:p-6 text-center">
                  {w.serving ? (
                    <p className={`font-mono text-4xl md:text-5xl font-bold ${getWindowTextColor(w.windowId)} animate-pulse leading-none tracking-wider`}>
                      {w.serving}
                    </p>
                  ) : (
                    <p className="text-xl text-primary-foreground/20 font-medium">—</p>
                  )}
                </div>

                {/* Waiting list */}
                <div className="px-4 pb-4">
                  <p className="text-[10px] text-primary-foreground/30 uppercase tracking-wider mb-1.5 font-medium">
                    Waiting ({w.waiting.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {w.waiting.slice(0, 6).map(t => (
                      <span key={t} className="font-mono text-[10px] bg-primary-foreground/8 text-primary-foreground/60 px-1.5 py-0.5 rounded">
                        {t}
                      </span>
                    ))}
                    {w.waiting.length > 6 && (
                      <span className="text-[10px] text-primary-foreground/30 px-1.5 py-0.5">+{w.waiting.length - 6}</span>
                    )}
                    {w.waiting.length === 0 && (
                      <span className="text-[10px] text-primary-foreground/20">No one waiting</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — Ad Panel */}
        <div className="w-[40%] max-w-[500px] border-l border-primary-foreground/10 flex-shrink-0">
          <MediaPanel ad={activeAd} />
        </div>
      </div>

      {/* Footer ticker */}
      {settings?.ticker_text && (
        <footer className="bg-primary px-0 py-2 flex-shrink-0 overflow-hidden">
          <div className="animate-marquee whitespace-nowrap">
            <span className="text-sm font-medium text-primary-foreground mx-8">{settings.ticker_text}</span>
            <span className="text-sm font-medium text-primary-foreground mx-8">{settings.ticker_text}</span>
            <span className="text-sm font-medium text-primary-foreground mx-8">{settings.ticker_text}</span>
          </div>
        </footer>
      )}
    </div>
  );
};

export default DisplayPage;
