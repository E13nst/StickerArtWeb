import axios from 'axios';
import { MemeCandidateDto, MemeCandidateVoteResponseDto } from '@/types/meme';
import { apiClient } from './client';

/** Внутренний axios-клиент apiClient не экспортирует instance — используем getBaseURL/getHeaders */
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
 * GET /api/style-feed/feed/next
 * Возвращает следующую карточку ленты или null при 204 (лента пуста).
 * Бросает FeedLimitError при 429.
 */
export interface FeedLimitError {
  resetAt?: string;
  message?: string;
}

export class MemeFeedLimitReachedError extends Error {
  readonly resetAt?: string;
  constructor(info: FeedLimitError) {
    super(info.message ?? 'Дневной лимит свайпов исчерпан');
    this.name = 'MemeFeedLimitReachedError';
    this.resetAt = info.resetAt;
  }
}

export async function fetchNextMemeCandidate(): Promise<MemeCandidateDto | null> {
  try {
    const cfg = getAxiosConfig();
    const response = await axios.get<MemeCandidateDto>(
      `${cfg.baseURL}/style-feed/feed/next`,
      { headers: cfg.headers, validateStatus: (s) => s < 500 }
    );
    if (response.status === 204) return null;
    return response.data;
  } catch (error: unknown) {
    const err = error as { response?: { status?: number; data?: unknown } };
    if (err?.response?.status === 429) {
      const data = (err.response.data ?? {}) as FeedLimitError;
      throw new MemeFeedLimitReachedError(data);
    }
    throw new Error(getErrorMessage(error, 'Не удалось загрузить следующую карточку'));
  }
}

/**
 * POST /api/style-feed/{itemId}/like
 * isSwipe=true — свайп жест (записывает в дневной лимит и начисляет награду).
 */
export async function likeMemeCandidate(
  candidateId: number,
  isSwipe: boolean
): Promise<MemeCandidateVoteResponseDto> {
  const cfg = getAxiosConfig();
  const response = await axios.post<MemeCandidateVoteResponseDto>(
    `${cfg.baseURL}/style-feed/${candidateId}/like`,
    null,
    { headers: cfg.headers, params: { isSwipe } }
  );
  return response.data;
}

/**
 * POST /api/style-feed/{itemId}/dislike
 * isSwipe=true — свайп жест.
 */
export async function dislikeMemeCandidate(
  candidateId: number,
  isSwipe: boolean
): Promise<MemeCandidateVoteResponseDto> {
  const cfg = getAxiosConfig();
  const response = await axios.post<MemeCandidateVoteResponseDto>(
    `${cfg.baseURL}/style-feed/${candidateId}/dislike`,
    null,
    { headers: cfg.headers, params: { isSwipe } }
  );
  return response.data;
}

/**
 * DELETE /api/style-feed/{itemId}/like
 * Отмена лайка (без isSwipe).
 */
export async function removeMemeCanditateLike(candidateId: number): Promise<void> {
  const cfg = getAxiosConfig();
  await axios.delete(`${cfg.baseURL}/style-feed/${candidateId}/like`, {
    headers: cfg.headers,
  });
}

/**
 * DELETE /api/style-feed/{itemId}/dislike
 * Отмена дизлайка (без isSwipe).
 */
export async function removeMemeCandidateDislike(candidateId: number): Promise<void> {
  const cfg = getAxiosConfig();
  await axios.delete(`${cfg.baseURL}/style-feed/${candidateId}/dislike`, {
    headers: cfg.headers,
  });
}
