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
      borderTop: '1px solid var(--tg-theme-border-color, #e0e0e0)',
      borderBottom: '1px solid var(--tg-theme-border-color, #e0e0e0)',
      boxShadow: 'none'
    }}>
      <Tabs
        value={activeTab}
        onChange={handleChange}
        variant="fullWidth"
        sx={{
          '& .MuiTab-root': {
            minHeight: isSmallScreen ? 44 : 52,
            fontSize: isSmallScreen ? '0.8rem' : '0.875rem',
            fontWeight: 600,
            textTransform: 'none',
            color: 'var(--tg-theme-hint-color, #999999)',
            gap: isSmallScreen ? 0.25 : 0.5,
            transition: 'all 0.2s ease',
            minWidth: 0,
            flex: '1 1 33.3333%',
            maxWidth: '33.3333%',
            paddingLeft: isSmallScreen ? 8 : 14,
            paddingRight: isSmallScreen ? 8 : 14,
            whiteSpace: 'nowrap',
            '&.Mui-selected': {
              color: 'var(--tg-theme-button-color, #2481cc)',
              fontWeight: 'bold'
            },
            '&:hover': {
              color: 'var(--tg-theme-button-color, #2481cc)',
              opacity: 0.8
            }
          },
          '& .MuiTabs-indicator': {
            backgroundColor: 'var(--tg-theme-button-color, #2481cc)',
            height: 3,
            borderRadius: '3px 3px 0 0'
          }
        }}
      >
        <Tab
          icon={<CollectionsIcon sx={{ fontSize: isSmallScreen ? '1.05rem' : '1.2rem' }} />}
          label={labels.sets}
          iconPosition="top"
        />
        <Tab
          icon={<AccountBalanceWalletIcon sx={{ fontSize: isSmallScreen ? '1.05rem' : '1.2rem' }} />}
          label={labels.art}
          iconPosition="top"
        />
        <Tab
          icon={<EmojiEventsIcon sx={{ fontSize: isSmallScreen ? '1.05rem' : '1.2rem' }} />}
          label={labels.share}
          iconPosition="top"
        />
      </Tabs>
    </Box>
  );
};

export { TabPanel };
