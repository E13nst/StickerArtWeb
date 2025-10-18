import React from 'react';
import { Dialog, DialogContent } from '@mui/material';
import { StickerSetResponse } from '@/types/sticker';
import { StickerSetDetail } from './StickerSetDetail';

interface StickerPackModalProps {
  open: boolean;
  stickerSet: StickerSetResponse | null;
  onClose: () => void;
}

export const StickerPackModal: React.FC<StickerPackModalProps> = ({ open, stickerSet, onClose }) => {
  if (!stickerSet) return null;

  return (
    <Dialog open={open} onClose={onClose} fullScreen>
      <DialogContent sx={{ p: 2 }}>
        <StickerSetDetail
          stickerSet={stickerSet}
          onBack={onClose}
          onShare={() => {}}
          isInTelegramApp={true}
        />
      </DialogContent>
    </Dialog>
  );
};


