import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'operator';
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [hasRole, setHasRole] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s && requiredRole) {
        checkRole(s.user.id);
      } else if (s) {
        // Any authenticated user with any role
        checkAnyRole(s.user.id);
      } else {
        setHasRole(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s && requiredRole) {
        checkRole(s.user.id);
      } else if (s) {
        checkAnyRole(s.user.id);
      } else {
        setHasRole(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [requiredRole]);

  const checkRole = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', requiredRole!)
      .limit(1);
    setHasRole((data?.length || 0) > 0);
  };

  const checkAnyRole = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .limit(1);
    setHasRole((data?.length || 0) > 0);
  };

  // Loading
  if (session === undefined || hasRole === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground text-sm animate-pulse">Loading…</div>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  if (!hasRole) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground mb-2">Access Denied</p>
          <p className="text-sm text-muted-foreground">You don't have the required role to access this page.</p>
          <p className="text-xs text-muted-foreground mt-1">Contact an administrator to get access.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
