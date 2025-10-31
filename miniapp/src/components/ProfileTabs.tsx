import React from 'react';
import { 
  Box, 
  Tabs, 
  Tab, 
  useTheme,
  useMediaQuery
} from '@mui/material';
import CollectionsIcon from '@mui/icons-material/Collections';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';

interface ProfileTabsProps {
  activeTab: number;
  onChange: (newValue: number) => void;
  isInTelegramApp?: boolean;
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
        <Box sx={{ py: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export const ProfileTabs: React.FC<ProfileTabsProps> = ({
  activeTab,
  onChange
}) => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const labels = isSmallScreen 
    ? { sets: 'Сеты', art: 'ART', share: 'Ачивки' } 
    : { sets: 'Стикерсеты', art: 'ART-Points', share: 'Достижения' };

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    onChange(newValue);
  };

  return (
    <Box sx={{ 
      width: '100%',
      mb: 2,
      backgroundColor: 'transparent',
      color: 'var(--tg-theme-text-color, #000000)',
      borderRadius: 0,
      // Убираем лишние разделительные линии для более чистого вида в Telegram
      borderTop: 'none',
      borderBottom: 'none',
      boxShadow: 'none'
    }}>
      <Tabs
        value={activeTab}
        onChange={handleChange}
        variant="fullWidth"
        sx={{
          '& .MuiTab-root': {
            // Ещё компактнее: чтобы влезало без скролла даже в Telegram
            minHeight: 40,
            height: 40,
            maxHeight: 44,
            fontSize: isSmallScreen ? '0.85rem' : '0.9rem',
            fontWeight: 600,
            textTransform: 'none',
            color: 'var(--tg-theme-hint-color, #999999)',
            gap: 4, // текст ближе к иконке
            transition: 'all 0.2s ease',
            minWidth: 0,
            flex: '1 1 0', // равномерное распределение для fullWidth
            paddingLeft: isSmallScreen ? 8 : 10,
            paddingRight: isSmallScreen ? 8 : 10,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            alignItems: 'center',
            '&.Mui-selected': {
              color: 'var(--tg-theme-text-color, #ffffff)',
              fontWeight: 700
            },
            '&:hover': {
              color: 'var(--tg-theme-text-color, #ffffff)',
              opacity: 0.85
            }
          },
          '& .MuiTabs-indicator': {
            backgroundColor: 'var(--tg-theme-button-color, #2481cc)',
            height: 2,
            minHeight: 2,
            maxHeight: 2,
            borderRadius: 2
          }
        }}
      >
        <Tab
          disableRipple
          icon={<CollectionsIcon sx={{ fontSize: 18 }} />}
          label={labels.sets}
          iconPosition="start"
        />
        <Tab
          disableRipple
          icon={<AccountBalanceWalletIcon sx={{ fontSize: 18 }} />}
          label={labels.art}
          iconPosition="start"
        />
        <Tab
          disableRipple
          icon={<EmojiEventsIcon sx={{ fontSize: 18 }} />}
          label={labels.share}
          iconPosition="start"
        />
      </Tabs>
    </Box>
  );
};

export { TabPanel };
