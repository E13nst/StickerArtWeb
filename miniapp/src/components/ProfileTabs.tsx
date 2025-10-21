import React from 'react';
import { 
  Box, 
  Tabs, 
  Tab, 
  useTheme,
  useMediaQuery
} from '@mui/material';
import CollectionsIcon from '@mui/icons-material/Collections';
import PersonIcon from '@mui/icons-material/Person';
import ShareIcon from '@mui/icons-material/Share';

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

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    onChange(newValue);
  };

  return (
    <Box sx={{ 
      width: '100%',
      mb: 2,
      backgroundColor: 'var(--tg-theme-secondary-bg-color)',
      color: 'var(--tg-theme-text-color)',
      borderRadius: 2,
      border: '1px solid var(--tg-theme-border-color)',
      boxShadow: '0 1px 3px var(--tg-theme-shadow-color)'
    }}>
      <Tabs
        value={activeTab}
        onChange={handleChange}
        variant={isSmallScreen ? 'fullWidth' : 'standard'}
        sx={{
          '& .MuiTab-root': {
            minHeight: isSmallScreen ? 48 : 56,
            fontSize: isSmallScreen ? '0.8rem' : '0.9rem',
            fontWeight: 'bold',
            textTransform: 'none',
            color: 'var(--tg-theme-text-color)',
            '&.Mui-selected': {
              color: 'var(--tg-theme-button-color)',
            },
          },
          '& .MuiTabs-indicator': {
            backgroundColor: 'var(--tg-theme-button-color)',
            height: 3,
            borderRadius: '3px 3px 0 0'
          }
        }}
      >
        <Tab
          icon={<CollectionsIcon />}
          label="Стикерсеты"
          iconPosition="top"
        />
        <Tab
          icon={<PersonIcon />}
          label="ART-Points"
          iconPosition="top"
        />
        <Tab
          icon={<ShareIcon />}
          label="Поделиться"
          iconPosition="top"
        />
      </Tabs>
    </Box>
  );
};

export { TabPanel };
