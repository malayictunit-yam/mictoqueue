import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CATEGORIES, CategoryKey, getWindowColor } from '@/lib/queue';
import { Ticket, FileText, Shield, Building2, Clock } from 'lucide-react';

const COOLDOWN_MS = 2 * 60 * 1000;
const COOLDOWN_KEY = 'queue_last_ticket';

const ICONS: Record<string, React.ElementType> = {
  WP: FileText,
  BP: Building2,
  SP: Shield,
  ATO: Ticket,
};

interface ActiveCategory {
  key: string;
  is_active: boolean;
}

interface TicketResult {
  label: string;
  window: number;
  category: string;
  clientName: string;
}

const KioskPage = () => {
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState<TicketResult | null>(null);
  const [error, setError] = useState('');
  const [clientName, setClientName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());
  const [labelOverrides, setLabelOverrides] = useState<Record<string, string>>({});

  const getCatLabel = useCallback(
    (key: string, fallback: string) => labelOverrides[key] || fallback,
    [labelOverrides]
  );

  useEffect(() => {
    const fetchActive = async () => {
      const { data } = await supabase.from('window_labels').select('category, is_active, label');
      if (data) {
        setActiveCategories(new Set(data.filter(w => w.is_active).map(w => w.category)));
        const map: Record<string, string> = {};
        data.forEach(w => { if (w.label) map[w.category] = w.label; });
        setLabelOverrides(map);
      }
    };
    fetchActive();

    const channel = supabase
      .channel('kiosk-window-labels')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'window_labels' }, () => fetchActive())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const getCooldownRemaining = useCallback(() => {
    const last = localStorage.getItem(COOLDOWN_KEY);
    if (!last) return 0;
    const elapsed = Date.now() - parseInt(last);
    return Math.max(0, COOLDOWN_MS - elapsed);
  }, []);

  const canTakeTicket = () => getCooldownRemaining() === 0;

  useEffect(() => {
    const remaining = getCooldownRemaining();
    setCooldownRemaining(remaining);
    if (remaining <= 0) return;
    const interval = setInterval(() => {
      const r = getCooldownRemaining();
      setCooldownRemaining(r);
      if (r <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [ticket, getCooldownRemaining]);

  const formatTime = (ms: number) => {
    const totalSec = Math.ceil(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const handleSelectCategory = (category: CategoryKey) => {
    if (!canTakeTicket()) {
      setError(`Please wait ${formatTime(cooldownRemaining)} before getting another ticket.`);
      return;
    }
    setSelectedCategory(category);
    setError('');
  };

  const takeTicket = async () => {
    if (!selectedCategory) return;
    const name = clientName.trim().slice(0, 100);
    if (!name) {
      setError('Please enter your name.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase.rpc('get_next_ticket', {
        p_category: selectedCategory,
        p_client_name: name,
      });
      if (err) throw err;
      const row = data?.[0];
      if (row) {
        setTicket({
          label: row.ticket_label,
          window: row.window_num,
          category: selectedCategory,
          clientName: name,
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
              <p className="text-foreground font-semibold">{ticket.clientName}</p>
              <p className="text-muted-foreground text-sm">{getCatLabel(cat.key, cat.label)}</p>
              <div className="bg-secondary rounded-lg p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Proceed to</p>
                <p className="text-2xl font-bold text-foreground">Window {ticket.window}</p>
              </div>
              <p className="text-xs text-muted-foreground">Please wait for your number to be called</p>
            </div>
          </div>
          <button
            onClick={() => { setTicket(null); setClientName(''); setSelectedCategory(null); }}
            className="mt-6 w-full py-3 rounded-xl bg-secondary text-secondary-foreground font-medium hover:bg-muted transition-colors active:scale-[0.98]"
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  // Name input step
  if (selectedCategory) {
    const cat = CATEGORIES.find(c => c.key === selectedCategory)!;
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm animate-fade-in-up">
          <div className="text-center mb-6">
            <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl ${getWindowColor(cat.window)} mb-4`}>
              {(() => { const Icon = ICONS[cat.key]; return <Icon className="w-7 h-7 text-primary-foreground" />; })()}
            </div>
            <h1 className="text-2xl font-bold text-foreground">{getCatLabel(cat.key, cat.label)}</h1>
            <p className="text-muted-foreground text-sm mt-1">Enter your name to get a ticket</p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center">
              {error}
            </div>
          )}

          <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Your Name</label>
              <input
                type="text"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                maxLength={100}
                placeholder="e.g. Juan Dela Cruz"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
            </div>
            <button
              onClick={takeTicket}
              disabled={loading}
              className={`w-full py-3 rounded-xl ${getWindowColor(cat.window)} text-primary-foreground font-semibold hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50`}
            >
              {loading ? 'Getting Ticket…' : 'Get Ticket'}
            </button>
          </div>

          <button
            onClick={() => { setSelectedCategory(null); setError(''); }}
            className="mt-4 w-full py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted transition-colors"
          >
            ← Back
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
        {cooldownRemaining > 0 && (
          <div className="mb-4 p-4 rounded-xl bg-secondary border border-border text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider font-medium">Cooldown</span>
            </div>
            <p className="text-2xl font-bold font-mono text-foreground tabular-nums">{formatTime(cooldownRemaining)}</p>
            <p className="text-xs text-muted-foreground mt-1">before you can get another ticket</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {CATEGORIES.filter(cat => activeCategories.has(cat.key)).map((cat, i) => {
            const Icon = ICONS[cat.key];
            return (
              <button
                key={cat.key}
                onClick={() => handleSelectCategory(cat.key)}
                className="group flex items-center gap-4 p-5 rounded-xl bg-card shadow-sm border border-border hover:shadow-md hover:border-primary/30 transition-all active:scale-[0.98] text-left animate-fade-in-up"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${getWindowColor(cat.window)} flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{getCatLabel(cat.key, cat.label)}</p>
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
