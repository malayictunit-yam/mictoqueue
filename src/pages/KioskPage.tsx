import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CATEGORIES, CategoryKey, getWindowColor } from '@/lib/queue';
import { Ticket, FileText, Shield, Building2 } from 'lucide-react';

const COOLDOWN_MS = 3 * 60 * 1000;
const COOLDOWN_KEY = 'queue_last_ticket';

const ICONS: Record<string, React.ElementType> = {
  WP: FileText,
  BP: Building2,
  SP: Shield,
  ATO: Ticket,
};

interface TicketResult {
  label: string;
  window: number;
  category: string;
}

const KioskPage = () => {
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState<TicketResult | null>(null);
  const [error, setError] = useState('');

  const canTakeTicket = () => {
    const last = localStorage.getItem(COOLDOWN_KEY);
    if (!last) return true;
    return Date.now() - parseInt(last) > COOLDOWN_MS;
  };

  const takeTicket = async (category: CategoryKey) => {
    if (!canTakeTicket()) {
      setError('Please wait 3 minutes between tickets.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase.rpc('get_next_ticket', {
        p_category: category,
      });
      if (err) throw err;
      const row = data?.[0];
      if (row) {
        setTicket({
          label: row.ticket_label,
          window: row.window_num,
          category,
        });
        localStorage.setItem(COOLDOWN_KEY, Date.now().toString());
      }
    } catch (e: any) {
      setError(e.message || 'Failed to get ticket');
    } finally {
      setLoading(false);
    }
  };

  if (ticket) {
    const cat = CATEGORIES.find(c => c.key === ticket.category)!;
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm animate-fade-in-up">
          <div className="bg-card rounded-2xl shadow-xl overflow-hidden">
            <div className={`${getWindowColor(ticket.window)} p-6 text-primary-foreground text-center`}>
              <p className="text-sm font-medium opacity-90 uppercase tracking-wider">Your Ticket</p>
              <p className="font-mono-display text-5xl font-bold mt-2 leading-tight">{ticket.label}</p>
            </div>
            <div className="p-6 text-center space-y-3">
              <p className="text-muted-foreground text-sm">{cat.label}</p>
              <div className="bg-secondary rounded-lg p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Proceed to</p>
                <p className="text-2xl font-bold text-foreground">Window {ticket.window}</p>
              </div>
              <p className="text-xs text-muted-foreground">Please wait for your number to be called</p>
            </div>
          </div>
          <button
            onClick={() => setTicket(null)}
            className="mt-6 w-full py-3 rounded-xl bg-secondary text-secondary-foreground font-medium hover:bg-muted transition-colors active:scale-[0.98]"
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
            <Ticket className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground leading-tight">Queue Kiosk</h1>
          <p className="text-muted-foreground mt-1 text-sm">Select a service to get your ticket</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {CATEGORIES.map((cat, i) => {
            const Icon = ICONS[cat.key];
            return (
              <button
                key={cat.key}
                disabled={loading}
                onClick={() => takeTicket(cat.key)}
                className={`group flex items-center gap-4 p-5 rounded-xl bg-card shadow-sm border border-border hover:shadow-md hover:border-primary/30 transition-all active:scale-[0.98] disabled:opacity-50 text-left animate-fade-in-up`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${getWindowColor(cat.window)} flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{cat.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                </div>
                <div className="flex-shrink-0 text-xs font-medium text-muted-foreground bg-secondary px-2.5 py-1 rounded-md">
                  W{cat.window}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default KioskPage;
