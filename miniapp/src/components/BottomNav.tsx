import { FC } from 'react';
import { Navbar } from '@/components/ui/Navbar';
import './BottomNav.css';

interface BottomNavProps {
  activeTab?: number;
  onChange?: (newValue: number) => void;
  isInTelegramApp?: boolean;
}

/** Navbar всегда видим; модалки с keepNavbarVisible (StickerSetDetail) не перекрывают его бэкдропом. */
export const BottomNav: FC<BottomNavProps> = () => {
  return <Navbar />;
};
