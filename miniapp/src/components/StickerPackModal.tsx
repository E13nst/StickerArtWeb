import React from 'react';
import { Dialog, DialogContent } from '@mui/material';
import { StickerSetResponse } from '@/types/sticker';
import { StickerSetDetail } from './StickerSetDetail';

interface StickerPackModalProps {
  open: boolean;
  stickerSet: StickerSetResponse | null;
  onClose: () => void;
  onLike?: (id: number, title: string) => void;
}

export const StickerPackModal: React.FC<StickerPackModalProps> = ({ open, stickerSet, onClose, onLike }) => {
  if (!stickerSet) return null;

  return (
    <Dialog open={open} onClose={onClose} fullScreen data-testid="sticker-pack-modal">
      <DialogContent sx={{ p: 2 }}>
        <StickerSetDetail
          stickerSet={stickerSet}
          onBack={onClose}
          onShare={() => {}}
          onLike={onLike}
          isInTelegramApp={true}
        />
      </DialogContent>
    </Dialog>
  );
};


