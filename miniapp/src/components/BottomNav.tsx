import { FC } from 'react';
import { Navbar, type NavbarVariant } from '@/components/ui/Navbar';
import './BottomNav.css';

interface BottomNavProps {
  activeTab?: number;
  onChange?: (newValue: number) => void;
  isInTelegramApp?: boolean;
  /** По умолчанию две вкладки (Generate / Profile); после разблокировки дебага — полное меню. */
  variant?: NavbarVariant;
}

/** Нижняя панель всегда видна; модалки с keepNavbarVisible (StickerSetDetail) не перекрывают её бэкдропом. */
export const BottomNav: FC<BottomNavProps> = ({ variant = 'minimal' }) => {
  return <Navbar variant={variant} />;
};
