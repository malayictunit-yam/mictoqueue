import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { CATEGORIES, getWindowColor } from '@/lib/queue';
import { RotateCcw, BarChart3, AlertTriangle, Palette, LogOut, Users } from 'lucide-react';
import OperatorManager from '@/components/admin/OperatorManager';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

interface DayStats {
  category: string;
  total: number;
  served: number;
  skipped: number;
  waiting: number;
  serving: number;
}

const AdminPage = () => {
  const [stats, setStats] = useState<DayStats[]>([]);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmCategory, setConfirmCategory] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchStats = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data: tickets } = await supabase
      .from('tickets')
      .select('*')
      .gte('created_at', `${today}T00:00:00`)
      .order('number', { ascending: true });

    const dayStats: DayStats[] = CATEGORIES.map(cat => {
      const catTickets = tickets?.filter(t => t.category === cat.key) || [];
      return {
        category: cat.key,
        total: catTickets.length,
        served: catTickets.filter(t => t.status === 'done').length,
        skipped: catTickets.filter(t => t.status === 'skipped').length,
        waiting: catTickets.filter(t => t.status === 'waiting').length,
        serving: catTickets.filter(t => t.status === 'serving').length,
      };
    });
    setStats(dayStats);
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const runReset = async (category: string | null) => {
    setResetting(true);
    const { data, error } = await supabase.rpc('reset_queues', {
      p_category: category,
    });
    setResetting(false);

    if (error) {
      toast.error(error.message || 'Failed to reset queue');
      return;
    }

    toast.success(
      category
        ? `${category} queue reset — ${data ?? 0} pending ticket(s) deleted`
        : `All queues reset — ${data ?? 0} pending ticket(s) deleted`
    );
    setConfirmReset(false);
    setConfirmCategory(null);
    fetchStats();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out');
    navigate('/login');
  };

  const totalToday = stats.reduce((a, s) => a + s.total, 0);
  const totalServed = stats.reduce((a, s) => a + s.served, 0);
  const totalWaiting = stats.reduce((a, s) => a + s.waiting, 0);

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-in-up">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Administration</p>
            <h1 className="text-2xl font-bold text-foreground">Queue Management</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Back</Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-muted-foreground text-sm hover:text-foreground transition-colors"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 mb-6 animate-fade-in-up" style={{ animationDelay: '80ms' }}>
          <div className="bg-card rounded-xl p-5 shadow-sm border border-border">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Today's Tickets</p>
            <p className="text-3xl font-bold text-foreground tabular-nums mt-1">{totalToday}</p>
          </div>
          <div className="bg-card rounded-xl p-5 shadow-sm border border-border">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Served</p>
            <p className="text-3xl font-bold text-serving tabular-nums mt-1">{totalServed}</p>
          </div>
          <div className="bg-card rounded-xl p-5 shadow-sm border border-border">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Waiting</p>
            <p className="text-3xl font-bold text-primary tabular-nums mt-1">{totalWaiting}</p>
          </div>
        </div>

        {/* Per-window stats */}
        <div className="mb-8 animate-fade-in-up" style={{ animationDelay: '160ms' }}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Window Statistics</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {CATEGORIES.map(cat => {
              const s = stats.find(st => st.category === cat.key);
              return (
                <div key={cat.key} className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                  <div className={`${getWindowColor(cat.window)} px-4 py-2.5 flex items-center justify-between`}>
                    <span className="text-sm font-semibold text-primary-foreground">
                      Window {cat.window} — {cat.label}
                    </span>
                    <span className="text-xs font-mono text-primary-foreground/80">{cat.key}</span>
                  </div>
                  <div className="p-4 grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold tabular-nums text-foreground">{s?.total || 0}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">Total</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold tabular-nums text-serving">{s?.served || 0}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">Served</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold tabular-nums text-primary">{s?.waiting || 0}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">Waiting</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold tabular-nums text-destructive">{s?.skipped || 0}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">Skipped</p>
                    </div>
                  </div>
                  <div className="px-4 pb-4">
                    {confirmCategory === cat.key ? (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
                        <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                        <p className="text-xs text-destructive flex-1">Delete pending tickets for {cat.key}?</p>
                        <button
                          onClick={() => runReset(cat.key)}
                          disabled={resetting}
                          className="px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50"
                        >
                          {resetting ? '…' : 'Confirm'}
                        </button>
                        <button
                          onClick={() => setConfirmCategory(null)}
                          className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setConfirmReset(false); setConfirmCategory(cat.key); }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-destructive hover:text-destructive-foreground transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset This Queue
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Operator Accounts */}
        <div className="mb-8 animate-fade-in-up" style={{ animationDelay: '240ms' }}>
          <OperatorManager />
        </div>

        {/* Display Settings link */}
        <div className="mb-8 animate-fade-in-up" style={{ animationDelay: '320ms' }}>
          <Link
            to="/admin/display"
            className="flex items-center gap-4 p-5 bg-card rounded-xl border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all active:scale-[0.98]"
          >
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
              <Palette className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Display Settings</p>
              <p className="text-xs text-muted-foreground">Branding, window labels, ads & ticker</p>
            </div>
          </Link>
        </div>

        {/* Reset section */}
        <div className="animate-fade-in-up" style={{ animationDelay: '400ms' }}>
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-2">Queue Controls</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Reset all queues to clear waiting and serving tickets. This marks all active tickets as done and resets counters.
            </p>
            {!confirmReset ? (
              <button
                onClick={() => setConfirmReset(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-destructive text-destructive-foreground font-medium hover:opacity-90 transition-all active:scale-[0.98]"
              >
                <RotateCcw className="w-4 h-4" />
                Reset All Queues
              </button>
            ) : (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive flex-1">Are you sure? This cannot be undone.</p>
                <button
                  onClick={resetAllQueues}
                  disabled={resetting}
                  className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {resetting ? 'Resetting…' : 'Confirm'}
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
