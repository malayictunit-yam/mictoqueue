export type DisplayAdKind = 'image' | 'video' | 'website';

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif', '.bmp'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v', '.ogg'];

const getNormalizedPathname = (url: string) => {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
};

const hasKnownExtension = (pathname: string, extensions: string[]) => {
  return extensions.some(extension => pathname.endsWith(extension));
};

export const inferAdKindFromUrl = (url: string): DisplayAdKind => {
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.startsWith('data:image/')) return 'image';
  if (lowerUrl.startsWith('data:video/')) return 'video';

  const pathname = getNormalizedPathname(url);

  if (hasKnownExtension(pathname, VIDEO_EXTENSIONS)) return 'video';
  if (hasKnownExtension(pathname, IMAGE_EXTENSIONS)) return 'image';

  return 'website';
};

export const resolveAdKind = (ad: { type?: string; file_url: string }): DisplayAdKind => {
  if (ad.type === 'video' || ad.type === 'website') return ad.type;

  if (ad.type === 'image') {
    const inferredKind = inferAdKindFromUrl(ad.file_url);
    return inferredKind === 'video' ? 'video' : inferredKind;
  }

  return inferAdKindFromUrl(ad.file_url);
};

export const getAdDisplayName = (url: string, kind: DisplayAdKind) => {
  try {
    const parsedUrl = new URL(url);
    if (kind === 'website') return parsedUrl.hostname.replace(/^www\./, '');

    const fileName = parsedUrl.pathname.split('/').pop();
    return fileName || parsedUrl.hostname;
  } catch {
    const fallbackName = url.split('/').pop();
    return fallbackName || url;
  }
};