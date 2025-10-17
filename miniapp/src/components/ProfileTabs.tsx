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
      backgroundColor: 'background.paper',
      borderRadius: 2,
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
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
            '&.Mui-selected': {
              color: 'primary.main',
            },
          },
          '& .MuiTabs-indicator': {
            backgroundColor: 'primary.main',
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
          label="Стикеры"
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
