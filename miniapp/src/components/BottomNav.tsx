import { FC } from 'react';
import { Navbar } from '@/components/ui/Navbar';
import './BottomNav.css';

interface BottomNavProps {
  activeTab?: number;
  onChange?: (newValue: number) => void;
  isInTelegramApp?: boolean;
  /** Показывать нижнее меню (после разблокировки долгим нажатием на аватар в шапке). */
  visible?: boolean;
}

/** Navbar скрыт до разблокировки; модалки с keepNavbarVisible (StickerSetDetail) не перекрывают его бэкдропом. */
export const BottomNav: FC<BottomNavProps> = ({ visible = false }) => {
  if (!visible) return null;
  return <Navbar />;
};
