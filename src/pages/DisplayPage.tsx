import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CATEGORIES, getWindowColor, getWindowTextColor, speak } from '@/lib/queue';

interface WindowStatus {
  windowId: number;
  category: string;
  label: string;
  serving: string | null;
  waiting: string[];
}

const DisplayPage = () => {
  const [windows, setWindows] = useState<WindowStatus[]>([]);
  const prevServingRef = useRef<Record<number, string | null>>({});

  const fetchAll = useCallback(async () => {
    const { data: tickets } = await supabase
      .from('tickets')
      .select('*')
      .in('status', ['serving', 'waiting'])
      .order('number', { ascending: true });

    const statuses = CATEGORIES.map(cat => {
      const catTickets = tickets?.filter(t => t.category === cat.key) || [];
      const servingTicket = catTickets.find(t => t.status === 'serving');
      const waitingTickets = catTickets.filter(t => t.status === 'waiting');
      return {
        windowId: cat.window,
        category: cat.key,
        label: cat.label,
        serving: servingTicket?.ticket_number || null,
        waiting: waitingTickets.map(t => t.ticket_number),
      };
    });

    // TTS for newly serving tickets
    statuses.forEach(s => {
      const prev = prevServingRef.current[s.windowId];
      if (s.serving && s.serving !== prev) {
        speak(`Now serving ${s.serving.replace('-', ' ')} at window ${s.windowId}`);
      }
    });
    prevServingRef.current = Object.fromEntries(statuses.map(s => [s.windowId, s.serving]));

    setWindows(statuses);
  }, []);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel('display-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        fetchAll();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  return (
    <div className="min-h-screen bg-foreground p-4 md:p-8 flex flex-col">
      {/* Header */}
      <div className="text-center mb-6 md:mb-10 animate-fade-in-up">
        <h1 className="text-3xl md:text-5xl font-extrabold text-primary-foreground tracking-tight leading-tight">
          NOW SERVING
        </h1>
        <p className="text-primary-foreground/50 text-sm mt-1 uppercase tracking-widest">Queue Display</p>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6 flex-1">
        {windows.map((w, i) => (
          <div
            key={w.windowId}
            className="rounded-2xl overflow-hidden bg-card/5 border border-primary-foreground/10 animate-fade-in-up"
            style={{ animationDelay: `${i * 120}ms` }}
          >
            {/* Window header */}
            <div className={`${getWindowColor(w.windowId)} px-5 py-4 flex items-center justify-between`}>
              <div>
                <p className="text-xs font-semibold text-primary-foreground/80 uppercase tracking-wider">
                  Window {w.windowId}
                </p>
                <p className="text-sm font-medium text-primary-foreground/90">{w.label}</p>
              </div>
              <span className="text-xs font-medium bg-primary-foreground/20 text-primary-foreground px-2 py-0.5 rounded-md">
                {w.category}
              </span>
            </div>

            {/* Serving number */}
            <div className="p-6 md:p-8 text-center">
              {w.serving ? (
                <p className={`font-mono-display text-5xl md:text-6xl font-bold ${getWindowTextColor(w.windowId)} animate-pulse-gentle leading-none`}>
                  {w.serving}
                </p>
              ) : (
                <p className="text-2xl text-primary-foreground/30 font-medium">—</p>
              )}
            </div>

            {/* Waiting list */}
            <div className="px-5 pb-5">
              <p className="text-xs text-primary-foreground/40 uppercase tracking-wider mb-2 font-medium">
                Waiting ({w.waiting.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {w.waiting.slice(0, 8).map(t => (
                  <span
                    key={t}
                    className="font-mono-display text-xs bg-primary-foreground/10 text-primary-foreground/70 px-2 py-1 rounded-md"
                  >
                    {t}
                  </span>
                ))}
                {w.waiting.length > 8 && (
                  <span className="text-xs text-primary-foreground/40 px-2 py-1">
                    +{w.waiting.length - 8} more
                  </span>
                )}
                {w.waiting.length === 0 && (
                  <span className="text-xs text-primary-foreground/30">No one waiting</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DisplayPage;
