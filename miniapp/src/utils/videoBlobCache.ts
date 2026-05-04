import { cacheManager } from './cacheManager';

const isDev = (import.meta as any).env?.DEV;

async function isValidBlobUrlAsync(blobUrl: string): Promise<boolean> {
  try {
    const response = await fetch(blobUrl, { method: 'HEAD', cache: 'no-cache' });
    return response.ok;
  } catch {
    return false;
  }
}

function isValidBlobUrlFormat(blobUrl: string | null | undefined): boolean {
  if (!blobUrl || !blobUrl.startsWith('blob:')) {
    return false;
  }

  try {
    const url = new URL(blobUrl);
    return url.protocol === 'blob:';
  } catch {
    return false;
  }
}

export const videoBlobCache = {
  get: (fileId: string) => {
    const blobUrl = cacheManager.getSync(fileId, 'video');
    if (blobUrl && !isValidBlobUrlFormat(blobUrl)) {
      if (isDev) {
        console.warn(`[videoBlobCache] Invalid blob URL format for ${fileId}, removing from cache`);
      }
      cacheManager.delete(fileId, 'video').catch(() => {});
      return null;
    }
    return blobUrl;
  },
  has: (fileId: string) => {
    const blobUrl = cacheManager.getSync(fileId, 'video');
    return blobUrl !== null && isValidBlobUrlFormat(blobUrl);
  },
  isValid: async (fileId: string): Promise<boolean> => {
    const blobUrl = cacheManager.getSync(fileId, 'video');
    if (!blobUrl || !isValidBlobUrlFormat(blobUrl)) {
      return false;
    }
    return await isValidBlobUrlAsync(blobUrl);
  },
  set: async (fileId: string, data: string) => cacheManager.set(fileId, data, 'video'),
  delete: async (fileId: string) => cacheManager.delete(fileId, 'video'),
  clear: async () => cacheManager.clear('video'),
  keys: () => {
    const syncCache = (cacheManager as any).syncCache?.videos;
    return syncCache ? syncCache.keys() : [][Symbol.iterator]();
  },
};
