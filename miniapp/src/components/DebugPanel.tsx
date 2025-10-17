import React, { useState } from 'react';
import { 
  Card, 
  Typography, 
  Box, 
  Accordion, 
  AccordionSummary, 
  AccordionDetails,
  useTheme,
  useMediaQuery
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { TelegramUser } from '@/types/telegram';

interface DebugPanelProps {
  user: TelegramUser | null;
  initData: string;
  manualInitData?: string;
  platform?: string;
  version?: string;
  initDataValid: boolean;
  initDataError?: string;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  user,
  initData,
  manualInitData,
  platform,
  version,
  initDataValid,
  initDataError
}) => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('md')); // < 700px свернута
  
  const [expanded, setExpanded] = useState(!isSmallScreen); // Развернута по умолчанию на больших экранах

  const now = new Date();
  const authDate = initData ? new URLSearchParams(initData).get('auth_date') : null;
  const authDateTime = authDate ? new Date(parseInt(authDate) * 1000) : null;
  const signature = initData ? new URLSearchParams(initData).get('signature') : null;
  const hash = initData ? new URLSearchParams(initData).get('hash') : null;
  const queryId = initData ? new URLSearchParams(initData).get('query_id') : null;

  const debugItems = [
    {
      label: '🕐 Текущее время',
      value: now.toLocaleString()
    },
    {
      label: '📱 Telegram Platform',
      value: platform || 'unknown'
    },
    {
      label: '📋 Telegram Version',
      value: version || 'unknown'
    },
    {
      label: '🔐 InitData присутствует',
      value: initData ? '✅ Да' : '❌ Нет'
    },
    {
      label: '📏 InitData длина',
      value: initData ? `${initData.length} символов` : 'N/A'
    },
    {
      label: '🕒 Auth Date',
      value: authDateTime ? authDateTime.toLocaleString() : 'не найден'
    },
    {
      label: '⏰ Возраст InitData',
      value: authDate ? `${Math.floor((now.getTime() - authDateTime!.getTime()) / 1000)} секунд` : 'N/A'
    },
    {
      label: '✍️ Signature',
      value: signature ? `✅ Присутствует (${signature.length} символов)` : '❌ Отсутствует'
    },
    {
      label: '#️⃣ Hash',
      value: hash ? `✅ Присутствует (${hash.length} символов)` : '❌ Отсутствует'
    },
    {
      label: '🆔 Query ID',
      value: queryId || 'не найден'
    },
    {
      label: '👤 User ID',
      value: user?.id || 'не найден'
    },
    {
      label: '🌐 API Endpoint',
      value: `${window.location.origin}/auth/status`
    },
    {
      label: '✅ InitData валидация',
      value: initDataValid ? '✅ Валидна' : `❌ ${initDataError}`
    }
  ];

  return (
    <Card sx={{ mb: 2 }}>
      <Accordion 
        expanded={expanded} 
        onChange={() => setExpanded(!expanded)}
        sx={{ boxShadow: 'none' }}
      >
        <AccordionSummary 
          expandIcon={<ExpandMoreIcon />}
          sx={{ 
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            border: '1px solid rgba(33, 150, 243, 0.3)',
            borderRadius: 1
          }}
        >
          <Typography variant="subtitle2" color="primary" fontWeight="bold">
            🔍 Отладочная информация (initData)
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ mt: 1 }}>
            {debugItems.map((item, index) => (
              <Box 
                key={index}
                sx={{ 
                  mb: 1, 
                  p: 1, 
                  borderLeft: '3px solid #2196F3',
                  backgroundColor: 'rgba(33, 150, 243, 0.05)',
                  borderRadius: '0 4px 4px 0'
                }}
              >
                <Typography variant="body2" component="span" fontWeight="bold" color="primary">
                  {item.label}:
                </Typography>
                <Typography variant="body2" component="span" sx={{ ml: 1 }}>
                  {item.value}
                </Typography>
              </Box>
            ))}
            
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" fontWeight="bold" color="primary" gutterBottom>
                🔤 InitData от Telegram Web App:
              </Typography>
              <Box
                sx={{
                  p: 1,
                  backgroundColor: 'rgba(0, 0, 0, 0.1)',
                  borderRadius: 1,
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  wordBreak: 'break-all',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {initData || 'отсутствует'}
              </Box>
            </Box>
            
            {manualInitData && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" fontWeight="bold" color="primary" gutterBottom>
                  🔤 InitData из URL параметров:
                </Typography>
                <Box
                  sx={{
                    p: 1,
                    backgroundColor: 'rgba(0, 0, 0, 0.1)',
                    borderRadius: 1,
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    wordBreak: 'break-all',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {manualInitData}
                </Box>
              </Box>
            )}
          </Box>
        </AccordionDetails>
      </Accordion>
    </Card>
  );
};
