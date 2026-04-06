import { QRCodeSVG } from 'qrcode.react';
import { Ticket } from 'lucide-react';

const KIOSK_URL = 'https://mictoqueue.lovable.app/kiosk';

const PrintQRPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-white print:p-0">
      <div className="text-center max-w-md w-full">
        <div className="flex items-center justify-center gap-3 mb-6">
          <Ticket className="w-10 h-10 text-black" />
          <h1 className="text-3xl font-bold text-black">Queue System</h1>
        </div>

        <p className="text-lg text-gray-700 mb-8">Scan the QR code below to take a ticket</p>

        <div className="inline-block p-6 border-4 border-black rounded-2xl">
          <QRCodeSVG value={KIOSK_URL} size={280} level="H" />
        </div>

        <p className="text-sm text-gray-500 mt-4 break-all font-mono">{KIOSK_URL}</p>

        <p className="text-base text-gray-600 mt-6">No login required — just scan and get your queue number!</p>

        <button
          onClick={() => window.print()}
          className="mt-8 px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-all active:scale-[0.98] print:hidden"
        >
          Print This Page
        </button>
      </div>
    </div>
  );
};

export default PrintQRPage;
