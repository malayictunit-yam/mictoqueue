import { Link } from 'react-router-dom';
import { Ticket, Monitor, Tv, ShieldCheck, LogIn } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const KIOSK_URL = `${window.location.origin}/kiosk`;

const Index = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            <Ticket className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground leading-tight">Queue System</h1>
          <p className="text-muted-foreground mt-2">Government Services Queue Management</p>
        </div>

        {/* QR Code */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 mb-6 text-center animate-fade-in-up" style={{ animationDelay: '60ms' }}>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3">Scan to take a ticket</p>
          <div className="inline-block p-3 bg-white rounded-xl">
            <QRCodeSVG value={KIOSK_URL} size={160} level="M" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 break-all">{KIOSK_URL}</p>
        </div>

        <div className="space-y-3">
          <Link
            to="/kiosk"
            className="flex items-center gap-4 p-5 rounded-xl bg-card shadow-sm border border-border hover:shadow-md hover:border-primary/30 transition-all active:scale-[0.98] animate-fade-in-up"
            style={{ animationDelay: '140ms' }}
          >
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
              <Monitor className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Kiosk</p>
              <p className="text-xs text-muted-foreground">Take a ticket for service</p>
            </div>
          </Link>

          <Link
            to="/display"
            className="flex items-center gap-4 p-5 rounded-xl bg-card shadow-sm border border-border hover:shadow-md hover:border-primary/30 transition-all active:scale-[0.98] animate-fade-in-up"
            style={{ animationDelay: '220ms' }}
          >
            <div className="w-12 h-12 rounded-xl bg-foreground flex items-center justify-center flex-shrink-0">
              <Tv className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Display Screen</p>
              <p className="text-xs text-muted-foreground">TV dashboard — now serving</p>
            </div>
          </Link>

          <Link
            to="/login"
            className="flex items-center gap-4 p-5 rounded-xl bg-card shadow-sm border border-border hover:shadow-md hover:border-primary/30 transition-all active:scale-[0.98] animate-fade-in-up"
            style={{ animationDelay: '300ms' }}
          >
            <div className="w-12 h-12 rounded-xl bg-destructive flex items-center justify-center flex-shrink-0">
              <LogIn className="w-6 h-6 text-destructive-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Staff Login</p>
              <p className="text-xs text-muted-foreground">Admin & Operator access</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Index;
