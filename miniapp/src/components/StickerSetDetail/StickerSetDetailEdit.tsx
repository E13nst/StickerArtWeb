import { useState, useMemo, useCallback, FC, useEffect } from 'react';
import { DeleteIcon, RestoreIcon } from '@/components/ui/Icons';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { IconButton } from '@/components/ui/IconButton';
import { Alert } from '@/components/ui/Alert';
import { StickerSetResponse, Sticker, StickerSetEditOperations } from '@/types/sticker';
import { StickerThumbnail } from '../StickerThumbnail';

interface StickerSetDetailEditProps {
  stickerSet: StickerSetResponse;
  onCancel: () => void;
  onDone: (ops: StickerSetEditOperations) => void;
}

// Иконка "бургер" для drag handle
const BurgerIcon: FC<{ size?: number }> = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{ display: 'block' }}
  >
    <rect x="3" y="7" width="18" height="2" rx="1" />
    <rect x="3" y="11" width="18" height="2" rx="1" />
    <rect x="3" y="15" width="18" height="2" rx="1" />
  </svg>
);

export const StickerSetDetailEdit: FC<StickerSetDetailEditProps> = ({
  stickerSet,
  onCancel,
  onDone
}) => {
  // Исходный список стикеров
  const originalStickers = stickerSet.telegramStickerSetInfo?.stickers ?? [];
  const originalOrder = useMemo(
    () => originalStickers.map(s => s.file_id),
    [originalStickers]
  );

  // Локальное состояние редактора
  const [editingStickers, setEditingStickers] = useState<Sticker[]>(() =>
    [...originalStickers]
  );
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [emojiUpdates, setEmojiUpdates] = useState<Record<string, string>>({});
  const [showNotification, setShowNotification] = useState(false);

  // Авто-скрытие уведомления через 4 сек
  useEffect(() => {
    if (!showNotification) return;
    const t = setTimeout(() => setShowNotification(false), 4000);
    return () => clearTimeout(t);
  }, [showNotification]);

  // Переключение удаления стикера
  const toggleDelete = useCallback((fileId: string) => {
    setDeletedIds(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }, []);

  // Обновление эмодзи
  const updateEmoji = useCallback((fileId: string, emoji: string) => {
    setEmojiUpdates(prev => ({
      ...prev,
      [fileId]: emoji
    }));
  }, []);

  // Перемещение стикера вверх
  const moveUp = useCallback((index: number) => {
    if (index === 0) return;
    setEditingStickers(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  // Перемещение стикера вниз
  const moveDown = useCallback((index: number) => {
    setEditingStickers(prev => {
      if (index === prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, []);

  // Вычисление текущего эмодзи для стикера
  const getCurrentEmoji = useCallback((sticker: Sticker) => {
    return emojiUpdates[sticker.file_id] ?? sticker.emoji ?? '';
  }, [emojiUpdates]);

  // Формирование объекта StickerSetEditOperations
  const computeOperations = useCallback((): StickerSetEditOperations => {
    const ops: StickerSetEditOperations = {};

    // Проверяем изменение порядка
    const currentOrder = editingStickers.map(s => s.file_id);
    const hasOrderChanged = currentOrder.length !== originalOrder.length ||
      currentOrder.some((id, idx) => id !== originalOrder[idx]);

    if (hasOrderChanged) {
      ops.reorder = currentOrder;
    }

    // Собираем обновления эмодзи (только те, что отличаются от исходных)
    const emojiChanges: Record<string, string> = {};
    for (const [fileId, newEmoji] of Object.entries(emojiUpdates)) {
      const originalSticker = originalStickers.find(s => s.file_id === fileId);
      if (originalSticker && originalSticker.emoji !== newEmoji) {
        emojiChanges[fileId] = newEmoji;
      }
    }
    if (Object.keys(emojiChanges).length > 0) {
      ops.emojiUpdates = emojiChanges;
    }

    // Преобразуем Set в массив
    if (deletedIds.size > 0) {
      ops.deleted = Array.from(deletedIds);
    }

    return ops;
  }, [editingStickers, originalOrder, emojiUpdates, deletedIds, originalStickers]);

  // Обработка нажатия "Готово"
  const handleDone = useCallback(() => {
    const ops = computeOperations();

    // Проверяем, есть ли изменения
    const hasChanges =
      !!ops.reorder ||
      (!!ops.emojiUpdates && Object.keys(ops.emojiUpdates).length > 0) ||
      (!!ops.deleted && ops.deleted.length > 0);

    if (!hasChanges) {
      onCancel();
      return;
    }

    console.log('Изменения (не сохраняются):', ops);
    setShowNotification(true);
    onDone(ops);
  }, [computeOperations, onCancel, onDone]);

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '16px'
      }}
    >
      <Text
        variant="h4"
        weight="bold"
        style={{
          color: 'var(--tg-theme-text-color)',
          fontWeight: 600,
          marginBottom: '8px'
        }}
      >
        Редактирование стикерсета
      </Text>

      <div style={{ width: '100%', padding: 0 }}>
        {editingStickers.map((sticker, index) => {
          const isDeleted = deletedIds.has(sticker.file_id);
          const currentEmoji = getCurrentEmoji(sticker);

          return (
            <div
              key={sticker.file_id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px',
                marginBottom: '8px',
                backgroundColor: 'rgba(var(--tg-theme-bg-color-rgb, 255, 255, 255), 0.1)',
                borderRadius: '12px',
                border: '1px solid rgba(var(--tg-theme-border-color-rgb, 0, 0, 0), 0.1)',
                opacity: isDeleted ? 0.5 : 1,
                transition: 'opacity 200ms ease'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  cursor: 'grab',
                  color: 'var(--tg-theme-hint-color)'
                }}
              >
                <BurgerIcon size={20} />
              </div>

              <div style={{ flexShrink: 0 }}>
                <StickerThumbnail
                  fileId={sticker.file_id}
                  thumbFileId={sticker.thumb?.file_id}
                  emoji={sticker.emoji}
                  size={64}
                />
              </div>

              <Input
                value={currentEmoji}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateEmoji(sticker.file_id, e.target.value)
                }
                placeholder="Эмодзи"
                size="small"
                style={{
                  flex: '1 1 auto',
                  minWidth: 80,
                  maxWidth: 120
                }}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <IconButton
                  size="small"
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                  aria-label="Вверх"
                  style={{
                    width: 24,
                    height: 24,
                    padding: 0,
                    color: 'var(--tg-theme-hint-color)',
                    opacity: index === 0 ? 0.3 : 1
                  }}
                >
                  ↑
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => moveDown(index)}
                  disabled={index === editingStickers.length - 1}
                  aria-label="Вниз"
                  style={{
                    width: 24,
                    height: 24,
                    padding: 0,
                    color: 'var(--tg-theme-hint-color)',
                    opacity: index === editingStickers.length - 1 ? 0.3 : 1
                  }}
                >
                  ↓
                </IconButton>
              </div>

              <IconButton
                size="small"
                onClick={() => toggleDelete(sticker.file_id)}
                aria-label={isDeleted ? 'Восстановить' : 'Удалить'}
                style={{
                  width: 32,
                  height: 32,
                  color: isDeleted
                    ? 'var(--tg-theme-link-color)'
                    : 'var(--tg-theme-destructive-text-color, #f44336)'
                }}
              >
                {isDeleted ? <RestoreIcon /> : <DeleteIcon />}
              </IconButton>
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: 'flex',
          gap: '16px',
          justifyContent: 'flex-end',
          marginTop: '16px',
          paddingTop: '8px',
          borderTop: '1px solid rgba(var(--tg-theme-border-color-rgb, 0, 0, 0), 0.1)'
        }}
      >
        <Button
          variant="outline"
          onClick={onCancel}
          style={{
            color: 'var(--tg-theme-text-color)',
            borderColor: 'rgba(var(--tg-theme-border-color-rgb, 0, 0, 0), 0.3)'
          }}
        >
          Отмена
        </Button>
        <Button
          variant="primary"
          onClick={handleDone}
          style={{
            backgroundColor: 'var(--tg-theme-button-color, #2481cc)',
            color: 'var(--tg-theme-button-text-color, #ffffff)'
          }}
        >
          Готово
        </Button>
      </div>

      {showNotification && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1400,
            maxWidth: '90%'
          }}
        >
          <Alert
            severity="info"
            style={{
              backgroundColor: 'rgba(var(--tg-theme-bg-color-rgb, 255, 255, 255), 0.95)',
              color: 'var(--tg-theme-text-color)'
            }}
          >
            Изменения пока не сохраняются на сервере. Это прототип редактора.
          </Alert>
        </div>
      )}
    </div>
  );
};
