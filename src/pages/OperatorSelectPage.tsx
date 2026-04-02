import { useNavigate } from 'react-router-dom';
import { CATEGORIES, getWindowColor } from '@/lib/queue';
import { LogOut, Monitor } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const OperatorSelectPage = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col">
      <div className="max-w-lg mx-auto w-full flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-8 animate-fade-in-up">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Operator</p>
            <h1 className="text-xl font-bold text-foreground">Select Your Window</h1>
          </div>
          <button
            onClick={handleLogout}
            className="p-2.5 rounded-xl bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          {CATEGORIES.map((cat, i) => (
            <button
              key={cat.key}
              onClick={() => navigate(`/operator/${cat.window}`)}
              className="w-full animate-fade-in-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className={`flex items-center gap-4 p-5 rounded-2xl border-2 border-border bg-card hover:shadow-lg transition-all active:scale-[0.98]`}>
                <div className={`w-12 h-12 rounded-xl ${getWindowColor(cat.window)} flex items-center justify-center`}>
                  <Monitor className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-foreground">Window {cat.window}</p>
                  <p className="text-sm text-muted-foreground">{cat.label}</p>
                </div>
                <div className="text-muted-foreground">›</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OperatorSelectPage;
