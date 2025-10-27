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
        <Box sx={{ py: 1.5 }}> {/* уменьшено для компактности */}
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
      mb: 1.5, // уменьшено для экономии пространства
      backgroundColor: 'var(--tg-theme-secondary-bg-color)',
      color: 'var(--tg-theme-text-color)',
      borderRadius: 1.5, // уменьшено для компактности
      border: '1px solid var(--tg-theme-border-color)',
      boxShadow: '0 1px 3px var(--tg-theme-shadow-color)'
    }}>
      <Tabs
        value={activeTab}
        onChange={handleChange}
        variant={isSmallScreen ? 'fullWidth' : 'standard'}
        sx={{
          '& .MuiTab-root': {
            minHeight: isSmallScreen ? 40 : 44, // уменьшено для компактности
            fontSize: isSmallScreen ? '0.75rem' : '0.8rem', // уменьшено для компактности
            fontWeight: 'bold',
            textTransform: 'none',
            color: 'var(--tg-theme-text-color)',
            '&.Mui-selected': {
              color: 'var(--tg-theme-button-color)',
            },
          },
          '& .MuiTabs-indicator': {
            backgroundColor: 'var(--tg-theme-button-color)',
            height: 2, // уменьшено для компактности
            borderRadius: '2px 2px 0 0' // уменьшено для компактности
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
