export function extractHttpErrorMessage(error: unknown, fallback: string): string {
  const err = error as {
    code?: string;
    message?: string;
    response?: { status?: number; data?: unknown };
    request?: unknown;
  };
  const status = err?.response?.status;

  if (status === 413) {
    return 'Изображение слишком большое. Попробуйте выбрать другое фото или уменьшить его размер.';
  }

  const data = err?.response?.data;
  if (data == null) {
    // Сервер мог не ответить (CORS, timeout, offline, aborted request).
    if (err?.code === 'ECONNABORTED') {
      return 'Сервер долго не отвечает. Попробуйте еще раз.';
    }
    if (err?.request) {
      return 'Не удалось получить ответ от сервера. Проверьте сеть и повторите попытку.';
    }
    return fallback;
  }

  if (typeof data === 'string' && data.length > 0 && data.length < 500) {
    const trimmed = data.trim();
    const looksLikeHtml = /^<!doctype|^<html[\s>]|^<head[\s>]|^<body[\s>]|<h1[\s>]|<\/html>$/i.test(trimmed);
    if (!looksLikeHtml) return trimmed;
  }

  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const validationErrorsRaw = obj.validationErrors;
    if (validationErrorsRaw && typeof validationErrorsRaw === 'object') {
      const validationErrors = validationErrorsRaw as Record<string, unknown>;
      const firstValidationMessage = Object.values(validationErrors).find(
        (value) => typeof value === 'string' && value.trim().length > 0,
      ) as string | undefined;
      if (firstValidationMessage) return firstValidationMessage.trim();
    }

    if (typeof obj.detail === 'string' && obj.detail.length > 0) return obj.detail;

    const msg =
      obj.message ??
      obj.error ??
      obj.errorMessage ??
      obj.reason ??
      (typeof obj.description === 'string' ? obj.description : undefined) ??
      (typeof obj.title === 'string' && obj.title !== 'Error' ? obj.title : undefined);
    if (typeof msg === 'string' && msg.length > 0) return msg;

    const detail = obj.detail;
    if (Array.isArray(detail) && detail[0] && typeof detail[0] === 'object') {
      const first = detail[0] as Record<string, unknown>;
      if (typeof first.message === 'string') return first.message;
    }
    if (Array.isArray(detail) && detail[0] && typeof detail[0] === 'string') {
      return detail[0];
    }
  }

  return fallback;
}
