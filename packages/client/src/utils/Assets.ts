// Exaxmples of usage:
//* 1. In a background image: <div style={{backgroundImage: `url('${toAbsoluteUrl('/media/misc/pattern-1.jpg')}')`}}>...

import { URL_2 } from "@/config/urls";

//* 2. In img tag: <img src={toAbsoluteUrl('/media/avatars/300-2.jpg')} />
const toAbsoluteUrl = (pathname: string): string => {
  const baseUrl = import.meta.env.BASE_URL;

  if (baseUrl && baseUrl !== '/') {
    return import.meta.env.BASE_URL + pathname;
  } else {
    
    return pathname;
  }
};

const resolvePublicFileUrl = (path?: string | null): string | null => {
  const normalized = String(path ?? '').trim();
  if (!normalized) return null;
  if (/^(https?:|data:|blob:)/i.test(normalized)) return normalized;
  if (normalized.startsWith('/media/')) return toAbsoluteUrl(normalized);

  const publicPath = normalized.startsWith('/')
    ? normalized
    : normalized.includes('/')
      ? `/${normalized}`
      : `/imgs/${normalized}`;
  return `${URL_2.replace(/\/+$/, '')}${publicPath}`;
};



const resolveUserAvatarUrl = (image?: string | null): string =>
  resolvePublicFileUrl(image) || toAbsoluteUrl('/media/avatars/300-2.png');


export { toAbsoluteUrl, resolvePublicFileUrl, resolveUserAvatarUrl  };
