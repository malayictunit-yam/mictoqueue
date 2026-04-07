import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CATEGORIES } from '@/lib/queue';
import { getAdDisplayName, inferAdKindFromUrl, resolveAdKind } from '@/lib/displayAds';
import { Link } from 'react-router-dom';
import { Upload, Type, Tv, Image, Film, Trash2, Check, Link as LinkIcon, Globe } from 'lucide-react';
import { toast } from 'sonner';

interface DisplaySettings {
  id: string;
  department_name: string;
  logo_url: string | null;
  ticker_text: string;
  ad_fit_mode: string;
}

interface WindowLabel {
  id: string;
  window_id: number;
  label: string;
  category: string;
  is_active: boolean;
}

interface Ad {
  id: string;
  type: string;
  file_url: string;
  is_active: boolean;
}

const AdminDisplayPage = () => {
  const [settings, setSettings] = useState<DisplaySettings | null>(null);
  const [windowLabels, setWindowLabels] = useState<WindowLabel[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [deptName, setDeptName] = useState('');
  const [tickerText, setTickerText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadingAd, setUploadingAd] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const adInputRef = useRef<HTMLInputElement>(null);

  const fetchAll = useCallback(async () => {
    const [{ data: s }, { data: wl }, { data: a }] = await Promise.all([
      supabase.from('display_settings').select('*').limit(1).single(),
      supabase.from('window_labels').select('*').order('window_id'),
      supabase.from('ads').select('*').order('created_at', { ascending: false }),
    ]);
    if (s) {
      setSettings(s);
      setDeptName(s.department_name);
      setTickerText(s.ticker_text);
    }
    if (wl) setWindowLabels(wl);
    if (a) setAds(a);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const saveBranding = async () => {
    if (!settings) return;
    await supabase.from('display_settings').update({
      department_name: deptName,
      ticker_text: tickerText,
      updated_at: new Date().toISOString(),
    }).eq('id', settings.id);
    toast.success('Branding saved');
    fetchAll();
  };

  const uploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !settings) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `logos/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('display-assets').upload(path, file, { upsert: true });
    if (error) { toast.error('Upload failed'); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('display-assets').getPublicUrl(path);
    await supabase.from('display_settings').update({ logo_url: publicUrl, updated_at: new Date().toISOString() }).eq('id', settings.id);
    toast.success('Logo uploaded');
    setUploading(false);
    fetchAll();
  };

  const removeLogo = async () => {
    if (!settings) return;
    await supabase.from('display_settings').update({ logo_url: null, updated_at: new Date().toISOString() }).eq('id', settings.id);
    toast.success('Logo removed');
    fetchAll();
  };

  const updateWindowLabel = async (wl: WindowLabel, newLabel: string) => {
    await supabase.from('window_labels').update({ label: newLabel }).eq('id', wl.id);
    toast.success(`Window ${wl.window_id} label updated`);
    fetchAll();
  };

  const toggleWindowActive = async (wl: WindowLabel) => {
    await supabase.from('window_labels').update({ is_active: !wl.is_active }).eq('id', wl.id);
    toast.success(`Window ${wl.window_id} ${wl.is_active ? 'deactivated' : 'activated'}`);
    fetchAll();
  };

  const uploadAd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAd(true);
    const isVideo = file.type.startsWith('video/');
    const ext = file.name.split('.').pop();
    const path = `ads/ad-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('display-assets').upload(path, file);
    if (error) { toast.error('Upload failed'); setUploadingAd(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('display-assets').getPublicUrl(path);
    await supabase.from('ads').insert({ type: isVideo ? 'video' : 'image', file_url: publicUrl, is_active: false });
    toast.success('Media uploaded');
    setUploadingAd(false);
    fetchAll();
  };

  const [adUrl, setAdUrl] = useState('');
  const addAdByUrl = async () => {
    const url = adUrl.trim();
    if (!url) return;
    try { new URL(url); } catch { toast.error('Invalid URL'); return; }
    const type = inferAdKindFromUrl(url);
    const { error } = await supabase.from('ads').insert({ type, file_url: url, is_active: false });
    if (error) { toast.error('Failed to add media: ' + error.message); return; }
    toast.success('Media added from URL');
    setAdUrl('');
    fetchAll();
  };

  const toggleAdActive = async (ad: Ad) => {
    await supabase.from('ads').update({ is_active: !ad.is_active }).eq('id', ad.id);
    toast.success(ad.is_active ? 'Ad deactivated' : 'Ad activated');
    fetchAll();
  };

  const deleteAd = async (ad: Ad) => {
    await supabase.from('ads').delete().eq('id', ad.id);
    toast.success('Ad deleted');
    fetchAll();
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-in-up">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Administration</p>
            <h1 className="text-2xl font-bold text-foreground">Display Settings</h1>
          </div>
          <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Back to Admin</Link>
        </div>

        {/* 1. Branding */}
        <section className="bg-card rounded-xl border border-border p-6 shadow-sm mb-6 animate-fade-in-up" style={{ animationDelay: '80ms' }}>
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
            <Type className="w-4 h-4 text-muted-foreground" /> Branding
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Department Name</label>
              <input
                value={deptName}
                onChange={e => setDeptName(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Logo</label>
              <div className="flex items-center gap-3">
                {settings?.logo_url && (
                  <img src={settings.logo_url} alt="Logo" className="w-16 h-16 object-contain rounded-lg border border-border bg-white" />
                )}
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={uploadLogo} />
                <button
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors active:scale-[0.98] disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  {uploading ? 'Uploading…' : 'Upload Logo'}
                </button>
                {settings?.logo_url && (
                  <button onClick={removeLogo} className="text-xs text-destructive hover:underline">Remove</button>
                )}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Ticker / Scrolling Text</label>
              <textarea
                value={tickerText}
                onChange={e => setTickerText(e.target.value)}
                rows={2}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
            <button
              onClick={saveBranding}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-all active:scale-[0.98]"
            >
              <Check className="w-4 h-4" /> Save Branding
            </button>
          </div>
        </section>

        {/* 2. Window Labels */}
        <section className="bg-card rounded-xl border border-border p-6 shadow-sm mb-6 animate-fade-in-up" style={{ animationDelay: '160ms' }}>
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
            <Tv className="w-4 h-4 text-muted-foreground" /> Window Labels
          </h2>
          <div className="space-y-3">
            {windowLabels.map(wl => {
              const cat = CATEGORIES.find(c => c.key === wl.category);
              return (
                <div key={wl.id} className={`flex items-center gap-3 p-3 rounded-lg border ${wl.is_active ? 'border-border' : 'border-border bg-muted/50 opacity-60'}`}>
                  <button
                    onClick={() => toggleWindowActive(wl)}
                    className={`flex-shrink-0 w-10 h-6 rounded-full relative transition-colors ${wl.is_active ? 'bg-primary' : 'bg-input'}`}
                  >
                    <span className={`block w-5 h-5 rounded-full bg-background shadow-lg transition-transform absolute top-0.5 ${wl.is_active ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                  </button>
                  <span className="text-xs text-muted-foreground w-8 flex-shrink-0">W{wl.window_id}</span>
                  <input
                    defaultValue={wl.label}
                    onBlur={e => {
                      if (e.target.value !== wl.label) updateWindowLabel(wl, e.target.value);
                    }}
                    className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-1 rounded">
                    {cat?.key}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">Deactivating a window hides it from the TV display and the public kiosk.</p>
        </section>

        {/* 3. Advertisement */}
        <section className="bg-card rounded-xl border border-border p-6 shadow-sm mb-6 animate-fade-in-up" style={{ animationDelay: '240ms' }}>
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
            <Image className="w-4 h-4 text-muted-foreground" /> Advertisement Media
          </h2>
          <p className="text-xs text-muted-foreground mb-4">Multiple media can be active simultaneously. They rotate every 8 seconds on the TV display.</p>
          <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-secondary/50 border border-border">
            <span className="text-xs text-muted-foreground font-medium">Scale Mode:</span>
            <div className="flex rounded-lg overflow-hidden border border-border">
              <button
                onClick={async () => {
                  if (!settings) return;
                  await supabase.from('display_settings').update({ ad_fit_mode: 'fit' }).eq('id', settings.id);
                  toast.success('Scale mode set to Fit');
                  fetchAll();
                }}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  settings?.ad_fit_mode === 'fit' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-secondary'
                }`}
              >
                Fit
              </button>
              <button
                onClick={async () => {
                  if (!settings) return;
                  await supabase.from('display_settings').update({ ad_fit_mode: 'fill' }).eq('id', settings.id);
                  toast.success('Scale mode set to Fill');
                  fetchAll();
                }}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  settings?.ad_fit_mode !== 'fit' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-secondary'
                }`}
              >
                Fill
              </button>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {settings?.ad_fit_mode === 'fit' ? 'Shows full media with letterboxing' : 'Fills the panel, may crop edges'}
            </span>
          </div>
          <input ref={adInputRef} type="file" accept="image/*,video/mp4" className="hidden" onChange={uploadAd} />
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => adInputRef.current?.click()}
              disabled={uploadingAd}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors active:scale-[0.98] disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {uploadingAd ? 'Uploading…' : 'Upload File'}
            </button>
          </div>
          <div className="flex gap-2 mb-4">
            <input
              value={adUrl}
              onChange={e => setAdUrl(e.target.value)}
              placeholder="Paste image or video URL…"
              className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={addAdByUrl}
              disabled={!adUrl.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-colors active:scale-[0.98] disabled:opacity-50"
            >
              <LinkIcon className="w-4 h-4" /> Add URL
            </button>
          </div>

          {ads.length === 0 && <p className="text-xs text-muted-foreground">No media uploaded yet.</p>}
          <div className="space-y-3">
            {ads.map(ad => {
              const adKind = resolveAdKind(ad);
              const adName = getAdDisplayName(ad.file_url, adKind);

              return (
              <div key={ad.id} className={`flex items-center gap-3 p-3 rounded-lg border ${ad.is_active ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <div className="w-16 h-12 rounded-md overflow-hidden bg-secondary flex-shrink-0 flex items-center justify-center">
                  {adKind === 'image' ? (
                    <img src={ad.file_url} alt="" className="w-full h-full object-cover" />
                  ) : adKind === 'website' ? (
                    <Globe className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <Film className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground capitalize">{adKind}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{adName}</p>
                </div>
                <button
                  onClick={() => toggleAdActive(ad)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    ad.is_active
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                >
                  {ad.is_active ? 'Active' : 'Activate'}
                </button>
                <button onClick={() => deleteAd(ad)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )})}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminDisplayPage;
