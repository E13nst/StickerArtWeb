import React from 'react';
import { MenuIcon, CollectionsIcon, AccountBalanceWalletIcon } from '@/components/ui/Icons';
import './ProfileTabs.css';

export type ProfileTabsVariant = 'account' | 'profile';

interface ProfileTabsProps {
  activeTab: number;
  onChange: (newValue: number) => void;
  isInTelegramApp?: boolean;
  /** account = Create/Likes/Upload (MyProfilePage), profile = menu/stickers/Artpoints (ProfilePage) */
  variant?: ProfileTabsVariant;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`profile-tabpanel-${index}`}
      aria-labelledby={`profile-tab-${index}`}
      {...other}
    >
      {value === index && (
        <div className="profile-tabs__panel">
          {children}
        </div>
      )}
    </div>
  );
}

/** Вкладки для страницы другого пользователя (ProfilePage): menu, stickers, Artpoints */
const PROFILE_TABS = [
  { index: 0, Icon: MenuIcon, label: 'menu' },
  { index: 1, Icon: CollectionsIcon, label: 'stickers' },
  { index: 2, Icon: AccountBalanceWalletIcon, label: 'Artpoints' },
];

/** Вкладки для своей страницы ACCOUNT (MyProfilePage): Create, Likes, Upload */
const ACCOUNT_TABS = [
  { index: 0, Icon: CollectionsIcon, label: 'Create' },
  { index: 1, Icon: CollectionsIcon, label: 'Likes' },
  { index: 2, Icon: CollectionsIcon, label: 'Upload' },
];

export const ProfileTabs: React.FC<ProfileTabsProps> = ({
  activeTab,
  onChange,
  variant = 'profile'
}) => {
  const tabs = variant === 'account' ? ACCOUNT_TABS : PROFILE_TABS;
  const ariaLabel = variant === 'account' ? 'Create, Likes, Upload' : 'Account tabs';
  return (
    <div
      className={`profile-tabs ${variant === 'account' ? 'profile-tabs--account' : 'profile-tabs--profile'}`}
      data-figma-block={variant === 'account' ? 'create-likes-upload' : 'menu-stickers-artpoints'}
    >
      <div role="tablist" className="profile-tabs__list" aria-label={ariaLabel}>
        {tabs.map(({ index, Icon, label }) => (
          <button
            key={index}
            type="button"
            role="tab"
            aria-selected={activeTab === index}
            id={`profile-tab-${index}`}
            aria-controls={`profile-tabpanel-${index}`}
            aria-label={label}
            onClick={() => onChange(index)}
            className={`profile-tabs__tab ${activeTab === index ? 'profile-tabs__tab--active' : ''}`}
          >
            <span className="profile-tabs__icon">
              <Icon />
            </span>
            <span className="profile-tabs__label">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export { TabPanel };
