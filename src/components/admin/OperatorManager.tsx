import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, Trash2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface Operator {
  user_id: string;
  email: string;
  username: string;
}

const OperatorManager = () => {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchOperators = useCallback(async () => {
    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'operator');

    if (!roles?.length) { setOperators([]); return; }

    const userIds = roles.map(r => r.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', userIds);

    setOperators(
      (profiles || []).map(p => ({
        user_id: p.id,
        email: p.email || '',
        username: (p.email || '').replace('@operator.local', ''),
      }))
    );
  }, []);

  useEffect(() => { fetchOperators(); }, [fetchOperators]);

  const createOperator = async () => {
    if (!username.trim() || !password.trim()) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-operator', {
        body: { username: username.trim(), password },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); setCreating(false); return; }
      toast.success(`Operator "${username}" created`);
      setUsername('');
      setPassword('');
      fetchOperators();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create operator');
    }
    setCreating(false);
  };

  const deleteOperator = async (op: Operator) => {
    if (!confirm(`Delete operator "${op.username}"?`)) return;
    try {
      const { data, error } = await supabase.functions.invoke('create-operator', {
        body: { action: 'delete', user_id: op.user_id },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      toast.success('Operator deleted');
      fetchOperators();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  return (
    <section className="bg-card rounded-xl border border-border p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
        <UserPlus className="w-4 h-4 text-muted-foreground" /> Operator Accounts
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        Create simple username/password accounts for operators. They log in with <code>username@operator.local</code> and their password.
      </p>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          value={username}
          onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
          placeholder="Username"
          maxLength={30}
          className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="relative flex-1">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password (min 6)"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <button
          onClick={createOperator}
          disabled={creating || username.length < 3 || password.length < 6}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-colors active:scale-[0.98] disabled:opacity-50"
        >
          <UserPlus className="w-4 h-4" />
          {creating ? 'Creating…' : 'Create'}
        </button>
      </div>

      {operators.length === 0 ? (
        <p className="text-xs text-muted-foreground">No operator accounts yet.</p>
      ) : (
        <div className="space-y-2">
          {operators.map(op => (
            <div key={op.user_id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/50">
              <div>
                <p className="text-sm font-medium text-foreground">{op.username}</p>
                <p className="text-[10px] text-muted-foreground">{op.email}</p>
              </div>
              <button
                onClick={() => deleteOperator(op)}
                className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default OperatorManager;
