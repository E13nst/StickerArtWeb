import { useState, useMemo, useCallback, FC, useEffect } from 'react';
import { DeleteIcon, RestoreIcon } from '@/components/ui/Icons';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { IconButton } from '@/components/ui/IconButton';
import { Alert } from '@/components/ui/Alert';
import { StickerSetResponse, Sticker, StickerSetEditOperations } from '@/types/sticker';
import { StickerThumbnail } from '../StickerThumbnail';
import './StickerSetDetailEdit.css';

interface StickerSetDetailEditProps {
  stickerSet: StickerSetResponse;
  onCancel: () => void;
  onDone: (ops: StickerSetEditOperations) => void;
  /** Рендер: если передан, компонент отдаёт toolbar и content для внешней разметки (toolbar над карточкой) */
  renderLayout?: (props: { toolbar: React.ReactNode; content: React.ReactNode }) => React.ReactNode;
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
  onDone,
  renderLayout
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
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Авто-скрытие уведомления через 4 сек
  useEffect(() => {
    if (!showNotification) return;
    const t = setTimeout(() => setShowNotification(false), 4000);
    return () => clearTimeout(t);
  }, [showNotification]);

  // Поддержание selectedIndex в допустимых границах
  useEffect(() => {
    setSelectedIndex(i => Math.min(i, Math.max(0, editingStickers.length - 1)));
  }, [editingStickers.length]);

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
    setSelectedIndex(index - 1);
    setEditingStickers(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  // Перемещение стикера вниз
  const moveDown = useCallback((index: number) => {
    if (index >= editingStickers.length - 1) return;
    setSelectedIndex(index + 1);
    setEditingStickers(prev => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, [editingStickers.length]);

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

  const toolbar = (
    <div className="sticker-set-detail-edit__toolbar" role="toolbar" aria-label="Изменение порядка">
      <button
        type="button"
        className="sticker-set-detail-edit__toolbar-btn"
        onClick={() => moveUp(selectedIndex)}
        disabled={selectedIndex === 0}
        aria-label="Вверх"
      >
        ↑
      </button>
      <button
        type="button"
        className="sticker-set-detail-edit__toolbar-btn"
        onClick={() => moveDown(selectedIndex)}
        disabled={selectedIndex === editingStickers.length - 1}
        aria-label="Вниз"
      >
        ↓
      </button>
    </div>
  );

  const content = (
    <>
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
              onClick={() => setSelectedIndex(index)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setSelectedIndex(index)}
              aria-pressed={selectedIndex === index}
              aria-label={`Стикер ${index + 1}, нажмите для выбора`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px',
                marginBottom: '8px',
                backgroundColor: selectedIndex === index
                  ? 'rgba(var(--tg-theme-bg-color-rgb, 255, 255, 255), 0.18)'
                  : 'rgba(var(--tg-theme-bg-color-rgb, 255, 255, 255), 0.1)',
                borderRadius: '12px',
                border: `1px solid ${selectedIndex === index ? 'rgba(238, 68, 159, 0.4)' : 'rgba(var(--tg-theme-border-color-rgb, 0, 0, 0), 0.1)'}`,
                opacity: isDeleted ? 0.5 : 1,
                transition: 'opacity 200ms ease, background 150ms ease, border-color 150ms ease',
                cursor: 'pointer'
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
                  color: 'var(--tg-theme-hint-color)',
                  flexShrink: 0
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <BurgerIcon size={20} />
              </div>

              <div style={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                <StickerThumbnail
                  fileId={sticker.file_id}
                  thumbFileId={sticker.thumb?.file_id}
                  emoji={sticker.emoji}
                  size={64}
                />
              </div>

              <div onClick={(e) => e.stopPropagation()} style={{ flex: '1 1 auto', minWidth: 80, maxWidth: 120 }}>
                <Input
                  value={currentEmoji}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateEmoji(sticker.file_id, e.target.value)
                  }
                  placeholder="Эмодзи"
                  size="small"
                  style={{ width: '100%' }}
                />
              </div>

              <div onClick={(e) => e.stopPropagation()}>
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
            </div>
          );
        })}
      </div>

      <div className="sticker-set-detail-edit__actions" role="group" aria-label="Действия">
        <button
          type="button"
          className="sticker-set-detail-edit__actions-cancel"
          onClick={onCancel}
        >
          Отмена
        </button>
        <button
          type="button"
          className="sticker-set-detail-edit__actions-done"
          onClick={handleDone}
        >
          Готово
        </button>
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
    </>
  );

  if (renderLayout) {
    return renderLayout({
      toolbar,
      content: <div className="sticker-set-detail-edit">{content}</div>
    });
  }

  return (
    <div className="sticker-set-detail-edit">
      {toolbar}
      {content}
    </div>
  );
};
