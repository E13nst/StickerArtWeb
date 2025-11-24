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
        <Box sx={{ pt: 0, pb: '0.764rem' }}>
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

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    onChange(newValue);
  };

  // Пропорции Фибоначчи для всех элементов
  const baseUnit = 1; // Базовый размер в rem
  const spacing = {
    tiny: `${0.236 * baseUnit}rem`,    // 0.236
    small: `${0.382 * baseUnit}rem`,   // 0.382
    medium: `${0.5 * baseUnit}rem`,     // 0.500
    golden: `${0.618 * baseUnit}rem`,  // 0.618
    large: `${0.764 * baseUnit}rem`    // 0.764
  };
  
  const dividerWidth = '1px';
  const dividerColor = 'var(--tg-theme-border-color, rgba(0, 0, 0, 0.12))';
  const dividerOpacity = 0.618; // Золотое сечение
  const dividerTop = '23.6%'; // 0.236 пропорция Фибоначчи
  const dividerBottom = '23.6%';

  return (
    <Box sx={{ 
      width: '100%',
      mb: 0, // Убираем отступ снизу
      backgroundColor: 'transparent',
      color: 'var(--tg-theme-text-color, #000000)',
      borderRadius: 0,
      borderTop: 'none',
      boxShadow: 'none'
    }}>
      <Tabs
        value={activeTab}
        onChange={handleChange}
        variant="fullWidth"
        sx={{
          '& .MuiTab-root': {
            minHeight: 48,
            height: 48,
            maxHeight: 48,
            color: 'var(--tg-theme-hint-color, #999999)',
            transition: 'all 0.2s ease',
            minWidth: 0,
            flex: '1 1 0',
            padding: spacing.golden, // 0.618rem
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            '&:not(:last-child)::after': {
              content: '""',
              position: 'absolute',
              right: 0,
              top: dividerTop,
              bottom: dividerBottom,
              width: dividerWidth,
              backgroundColor: dividerColor,
              opacity: dividerOpacity
            },
            '&.Mui-selected': {
              color: 'var(--tg-theme-button-color, #2481cc)'
            },
            '&:hover': {
              color: 'var(--tg-theme-button-color, #2481cc)',
              opacity: 0.85
            }
          },
          '& .MuiTabs-indicator': {
            display: 'none' // Убираем стандартный индикатор
          }
        }}
      >
        <Tab
          disableRipple
          icon={<CollectionsIcon sx={{ fontSize: '1.5rem', margin: 0 }} />}
          iconPosition="top"
        />
        <Tab
          disableRipple
          icon={<AccountBalanceWalletIcon sx={{ fontSize: '1.5rem', margin: 0 }} />}
          iconPosition="top"
        />
        <Tab
          disableRipple
          icon={<EmojiEventsIcon sx={{ fontSize: '1.5rem', margin: 0 }} />}
          iconPosition="top"
        />
      </Tabs>
    </Box>
  );
};

export { TabPanel };
