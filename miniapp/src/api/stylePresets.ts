import axios from 'axios';
import type { PresetPublicationRequestDto } from './client';
import { StylePreset } from './client';
import { apiClient } from './client';

function getAxiosConfig() {
  return {
    baseURL: '/api',
    headers: apiClient.getHeaders(),
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  const err = error as { response?: { data?: unknown; status?: number } };
  const data = err?.response?.data;
  if (typeof data === 'string' && data.length > 0 && data.length < 500) return data.trim();
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const msg = obj['message'] ?? obj['error'] ?? obj['errorMessage'];
    if (typeof msg === 'string' && msg.length > 0) return msg;
  }
  return fallback;
}

/**
 * GET /api/style-presets/liked
 * Пресеты, добавленные текущим пользователем в сохранённые.
 */
export async function getLikedStylePresets(): Promise<StylePreset[]> {
  const cfg = getAxiosConfig();
  const response = await axios.get<StylePreset[]>(
    `${cfg.baseURL}/style-presets/liked`,
    { headers: cfg.headers }
  );
  return response.data;
}

/**
 * POST /api/style-presets/{presetId}/like
 * Добавить пресет в сохранённые. 400 если уже сохранён.
 */
export async function likeStylePreset(presetId: number): Promise<void> {
  const cfg = getAxiosConfig();
  try {
    await axios.post(
      `${cfg.baseURL}/style-presets/${presetId}/like`,
      null,
      { headers: cfg.headers }
    );
  } catch (error: unknown) {
    throw new Error(getErrorMessage(error, 'Не удалось добавить пресет в сохранённые'));
  }
}

/**
 * DELETE /api/style-presets/{presetId}/like
 * Убрать пресет из сохранённых. 400 если не был сохранён.
 */
export async function unlikeStylePreset(presetId: number): Promise<void> {
  const cfg = getAxiosConfig();
  try {
    await axios.delete(
      `${cfg.baseURL}/style-presets/${presetId}/like`,
      { headers: cfg.headers }
    );
  } catch (error: unknown) {
    throw new Error(getErrorMessage(error, 'Не удалось убрать пресет из сохранённых'));
  }
}

/**
 * POST /api/style-presets/{presetId}/publish
 * Переводит пресет из DRAFT на модерацию; списание ART по правилам бэкенда (часто 10 ART).
 */
export async function publishStylePreset(
  presetId: number,
  body: PresetPublicationRequestDto
): Promise<StylePreset> {
  const cfg = getAxiosConfig();
  try {
    const response = await axios.post<StylePreset>(
      `${cfg.baseURL}/style-presets/${presetId}/publish`,
      body,
      { headers: cfg.headers }
    );
    return response.data;
  } catch (error: unknown) {
    throw new Error(getErrorMessage(error, 'Не удалось опубликовать пресет'));
  }
}

/**
 * POST /api/style-presets/{presetId}/unpublish-catalog
 * Снятие с публикации в каталоге со стороны автора (одобренный пресет).
 */
export async function unpublishStylePresetFromCatalog(presetId: number): Promise<StylePreset> {
  const cfg = getAxiosConfig();
  try {
    const response = await axios.post<StylePreset>(
      `${cfg.baseURL}/style-presets/${presetId}/unpublish-catalog`,
      {},
      { headers: cfg.headers },
    );
    return response.data;
  } catch (error: unknown) {
    throw new Error(getErrorMessage(error, 'Не удалось снять пресет с публикации'));
  }
}

export interface UploadPresetReferenceOptions {
  onProgress?: (percent: number) => void;
}

/**
 * PUT /api/style-presets/{presetId}/reference
 * Загружает референс-изображение для пресета (только владелец).
 * Форматы: image/png, image/webp, image/jpeg. Макс. 3 MB.
 */
export async function uploadPresetReference(
  presetId: number,
  file: File,
  options: UploadPresetReferenceOptions = {}
): Promise<StylePreset> {
  return new Promise<StylePreset>((resolve, reject) => {
    const cfg = getAxiosConfig();
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `${cfg.baseURL}/style-presets/${presetId}/reference`);

    Object.entries(cfg.headers).forEach(([key, value]) => {
      if (key !== 'Content-Type') {
        xhr.setRequestHeader(key, String(value));
      }
    });

    if (options.onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          options.onProgress!(Math.round((e.loaded / e.total) * 100));
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as StylePreset);
        } catch {
          reject(new Error('Некорректный ответ сервера'));
        }
      } else {
        let message = 'Не удалось загрузить референс-изображение';
        try {
          const body = JSON.parse(xhr.responseText) as Record<string, unknown>;
          const msg = body['message'] ?? body['error'];
          if (typeof msg === 'string' && msg.length > 0) message = msg;
        } catch {}
        reject(new Error(message));
      }
    });

    xhr.addEventListener('error', () =>
      reject(new Error('Ошибка сети при загрузке изображения'))
    );
    xhr.addEventListener('abort', () =>
      reject(new Error('Загрузка отменена'))
    );

    xhr.send(formData);
  });
}

export interface GenerationPresetUploadOptions {
  onProgress?: (percent: number) => void;
}

/**
 * POST /api/generation/style-presets/{presetId}/preview — превью карточки стиля после создания черновика.
 */
export async function uploadGenerationStylePresetPreview(
  presetId: number,
  file: File,
  options: GenerationPresetUploadOptions = {}
): Promise<StylePreset> {
  return uploadGenerationPresetMultipart(presetId, file, '/generation/style-presets', 'preview', options);
}

/**
 * POST /api/generation/style-presets/{presetId}/reference — референс / второе фото после создания черновика.
 */
export async function uploadGenerationStylePresetReference(
  presetId: number,
  file: File,
  options: GenerationPresetUploadOptions = {}
): Promise<StylePreset> {
  return uploadGenerationPresetMultipart(presetId, file, '/generation/style-presets', 'reference', options);
}

function uploadGenerationPresetMultipart(
  presetId: number,
  file: File,
  basePath: string,
  segment: 'preview' | 'reference',
  options: GenerationPresetUploadOptions
): Promise<StylePreset> {
  return new Promise<StylePreset>((resolve, reject) => {
    const cfg = getAxiosConfig();
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${cfg.baseURL}${basePath}/${presetId}/${segment}`);

    Object.entries(cfg.headers).forEach(([key, value]) => {
      if (key !== 'Content-Type') {
        xhr.setRequestHeader(key, String(value));
      }
    });

    if (options.onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          options.onProgress!(Math.round((e.loaded / e.total) * 100));
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as StylePreset);
        } catch {
          reject(new Error('Некорректный ответ сервера'));
        }
      } else {
        let message = 'Не удалось загрузить изображение';
        try {
          const body = JSON.parse(xhr.responseText) as Record<string, unknown>;
          const msg = body['message'] ?? body['error'];
          if (typeof msg === 'string' && msg.length > 0) message = msg;
        } catch {
          /* ignore */
        }
        reject(new Error(message));
      }
    });

    xhr.addEventListener('error', () =>
      reject(new Error('Ошибка сети при загрузке изображения'))
    );
    xhr.addEventListener('abort', () =>
      reject(new Error('Загрузка отменена'))
    );

    xhr.send(formData);
  });
}
