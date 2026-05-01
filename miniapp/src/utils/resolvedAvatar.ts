import { getAvatarUrl, getOptimalAvatarFileId } from '@/utils/avatarUtils';
import type { UserInfo } from '@/types/user';
import type { TelegramUser } from '@/types/telegram';

export interface ResolvedAvatarInput {
  user?: TelegramUser | null;
  userInfo?: UserInfo | null;
  isProfileFromAuthenticatedApi?: boolean;
  avatarBlobUrl?: string | null;
  targetSize?: number;
  allowTelegramPhotoFallback?: boolean;
  fallbackUserId?: number | null;
}

export interface ResolvedAvatarContext {
  telegramUserId: number | null;
  telegramPhotoUrl: string | null;
  profileAvatarFileId: string | null;
  profileAvatarUrl: string | null;
  headerAvatarUrl: string | null;
  effectiveAvatarUrl: string | null;
  hasProfileAvatar: boolean;
}

const normalizeAvatarUrl = (value?: string | null): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const resolveAvatarContext = ({
  user,
  userInfo,
  isProfileFromAuthenticatedApi = false,
  avatarBlobUrl,
  targetSize = 160,
  allowTelegramPhotoFallback = false,
  fallbackUserId,
}: ResolvedAvatarInput): ResolvedAvatarContext => {
  const telegramUserId =
    user?.id ??
    userInfo?.telegramId ??
    userInfo?.userId ??
    userInfo?.id ??
    fallbackUserId ??
    null;

  const telegramPhotoUrl = normalizeAvatarUrl(user?.photo_url);
  const normalizedBlobUrl = normalizeAvatarUrl(avatarBlobUrl);

  const profileAvatarFileId =
    isProfileFromAuthenticatedApi && userInfo
      ? userInfo.profilePhotoFileId ?? getOptimalAvatarFileId(userInfo.profilePhotos, targetSize) ?? null
      : null;

  const profileAvatarUrl =
    isProfileFromAuthenticatedApi && userInfo
      ? profileAvatarFileId && userInfo.id
        ? getAvatarUrl(userInfo.id, profileAvatarFileId, undefined, targetSize) ?? null
        : normalizeAvatarUrl(userInfo.avatarUrl)
      : null;

  const hasProfileAvatar = Boolean(normalizedBlobUrl || profileAvatarFileId || profileAvatarUrl);
  const headerAvatarUrl =
    normalizedBlobUrl ||
    profileAvatarUrl ||
    (allowTelegramPhotoFallback ? telegramPhotoUrl : null);

  return {
    telegramUserId,
    telegramPhotoUrl,
    profileAvatarFileId,
    profileAvatarUrl,
    headerAvatarUrl,
    effectiveAvatarUrl: profileAvatarUrl || telegramPhotoUrl || null,
    hasProfileAvatar,
  };
};
