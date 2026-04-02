import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getCategoryByWindow, getWindowColor, getWindowBorderColor, speak } from '@/lib/queue';
import { SkipForward, RotateCcw, CheckCircle2, ChevronRight, Volume2, LogOut } from 'lucide-react';
import { toast } from 'sonner';

const OperatorPage = () => {
  const { windowId } = useParams<{ windowId: string }>();
  const wId = parseInt(windowId || '0');
  const cat = getCategoryByWindow(wId);
  const navigate = useNavigate();

  if (!cat) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground mb-2">Invalid Window</p>
          <p className="text-sm text-muted-foreground mb-4">Window "{windowId}" does not exist.</p>
          <button onClick={() => navigate('/admin')} className="text-primary underline text-sm">Go to Admin</button>
        </div>
      </div>
    );
  }

  const [currentServing, setCurrentServing] = useState<{ ticket: string; name: string } | null>(null);
  const [waitingCount, setWaitingCount] = useState(0);
  const [nextInQueue, setNextInQueue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);

  const fetchState = useCallback(async () => {
    const { data: servingData } = await supabase
      .from('tickets')
      .select('ticket_number, client_name')
      .eq('window_id', wId)
      .eq('status', 'serving')
      .limit(1);

    if (servingData?.[0]) {
      setCurrentServing({ ticket: servingData[0].ticket_number, name: servingData[0].client_name });
    } else {
      setCurrentServing(null);
    }

    const { data: waitingData } = await supabase
      .from('tickets')
      .select('ticket_number')
      .eq('category', cat.key)
      .eq('status', 'waiting')
      .order('number', { ascending: true });
    setWaitingCount(waitingData?.length || 0);
    setNextInQueue(waitingData?.[0]?.ticket_number || null);
  }, [wId, cat.key]);

  useEffect(() => {
    fetchState();
    const channel = supabase
      .channel(`operator-${wId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        fetchState();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchState, wId]);

  const handleNext = async () => {
    setLoading(true);
    const { data } = await supabase.rpc('call_next_ticket', { p_window_id: wId });
    const row = data?.[0];
    if (row?.ticket_label && ttsEnabled) {
      speak(`Now serving ticket number ${row.ticket_label.replace('-', ' ')} at window ${wId}`);
    }
    await fetchState();
    setLoading(false);
  };

  const handleRecall = async () => {
    setLoading(true);
    const { data } = await supabase.rpc('recall_ticket', { p_window_id: wId });
    const row = data?.[0];
    if (row?.ticket_label && ttsEnabled) {
      speak(`Recalling ticket number ${row.ticket_label.replace('-', ' ')} at window ${wId}`);
    }
    setLoading(false);
  };

  const handleSkip = async () => {
    setLoading(true);
    await supabase.rpc('skip_ticket', { p_window_id: wId });
    await fetchState();
    setLoading(false);
  };

  const handleDone = async () => {
    setLoading(true);
    await supabase.rpc('done_ticket', { p_window_id: wId });
    await fetchState();
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col">
      <div className="max-w-lg mx-auto w-full flex-1 flex flex-col">
        {/* Header */}
        <div className="animate-fade-in-up">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Operator Panel</p>
              <h1 className="text-xl font-bold text-foreground">Window {wId} — {cat.label}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTtsEnabled(!ttsEnabled)}
                className={`p-2.5 rounded-xl transition-colors ${ttsEnabled ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}
              >
                <Volume2 className="w-5 h-5" />
              </button>
              <button
                onClick={handleLogout}
                className="p-2.5 rounded-xl bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Now Serving */}
        <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <div className={`rounded-2xl border-2 ${getWindowBorderColor(wId)} bg-card overflow-hidden mb-4`}>
            <div className={`${getWindowColor(wId)} px-5 py-3`}>
              <p className="text-sm font-medium text-primary-foreground/90 uppercase tracking-wider">Now Serving</p>
            </div>
            <div className="p-6 text-center">
              {currentServing ? (
                <>
                  <p className="font-mono-display text-5xl font-bold text-foreground leading-tight">{currentServing.ticket}</p>
                  {currentServing.name && (
                    <p className="text-sm text-muted-foreground mt-2">{currentServing.name}</p>
                  )}
                </>
              ) : (
                <p className="text-lg text-muted-foreground">No ticket being served</p>
              )}
            </div>
          </div>
        </div>

        {/* Queue info */}
        <div className="grid grid-cols-2 gap-3 mb-6 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <div className="bg-card rounded-xl p-4 shadow-sm border border-border">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Waiting</p>
            <p className="text-3xl font-bold text-foreground tabular-nums">{waitingCount}</p>
          </div>
          <div className="bg-card rounded-xl p-4 shadow-sm border border-border">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Next Up</p>
            <p className="text-xl font-bold font-mono-display text-foreground">{nextInQueue || '—'}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-3 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <button
            onClick={handleNext}
            disabled={loading || waitingCount === 0}
            className={`w-full flex items-center justify-center gap-3 py-4 rounded-xl ${getWindowColor(wId)} text-primary-foreground font-semibold text-lg shadow-lg hover:shadow-xl transition-all active:scale-[0.98] disabled:opacity-40`}
          >
            <ChevronRight className="w-6 h-6" />
            Call Next
          </button>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={handleRecall}
              disabled={loading || !currentServing}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-card border border-border text-foreground font-medium hover:bg-secondary transition-colors active:scale-[0.97] disabled:opacity-40"
            >
              <RotateCcw className="w-5 h-5" />
              <span className="text-xs">Recall</span>
            </button>
            <button
              onClick={handleSkip}
              disabled={loading || !currentServing}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-card border border-border text-foreground font-medium hover:bg-secondary transition-colors active:scale-[0.97] disabled:opacity-40"
            >
              <SkipForward className="w-5 h-5" />
              <span className="text-xs">Skip</span>
            </button>
            <button
              onClick={handleDone}
              disabled={loading || !currentServing}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-serving text-serving-foreground font-medium hover:opacity-90 transition-all active:scale-[0.97] disabled:opacity-40"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-xs">Done</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OperatorPage;
