import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, TextField, Button } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import '../styles/common.css';
import '../styles/GeneratePage.css';

export const GeneratePage: React.FC = () => {
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  const handleGenerate = () => {
    if (!description.trim()) {
      return;
    }

    setIsGenerating(true);
    // TODO: Здесь будет интеграция с API для генерации стикера
    setTimeout(() => {
      setIsGenerating(false);
      // Временная заглушка - в будущем здесь будет обработка результата
      console.log('Генерация стикера:', description);
    }, 2000);
  };

  return (
    <Box className="generate-page">
      <Paper elevation={0} className="generate-card">
        <Box className="generate-icon-wrapper">
          <AutoAwesomeIcon className="generate-icon" />
        </Box>
        
        <Typography variant="h4" className="generate-title">
          Нарисуйте стикер
        </Typography>

        <Box
          sx={{
            mt: 3,
            position: 'relative',
          }}
        >
          <TextField
            fullWidth
            multiline
            rows={4}
            placeholder="Подробно опишите стикер, который хотите нарисовать, например: пушистый кот в очках сидит на окне"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="generate-input"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '12px',
                backgroundColor: 'color-mix(in srgb, var(--tg-theme-secondary-bg-color) 70%, transparent)',
                color: 'var(--tg-theme-text-color)',
                border: '1px solid color-mix(in srgb, var(--tg-theme-border-color) 60%, transparent)',
                backdropFilter: 'blur(12px) saturate(180%)',
                WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                paddingRight: '48px',
                paddingBottom: '48px',
                '&:hover': {
                  backgroundColor: 'color-mix(in srgb, var(--tg-theme-secondary-bg-color) 80%, transparent)',
                },
                '&.Mui-focused': {
                  backgroundColor: 'color-mix(in srgb, var(--tg-theme-secondary-bg-color) 80%, transparent)',
                  borderColor: 'var(--tg-theme-button-color)',
                },
                '& .MuiOutlinedInput-notchedOutline': {
                  border: 'none',
                },
                '& .MuiInputBase-input': {
                  color: 'var(--tg-theme-text-color)',
                  '&::placeholder': {
                    color: 'var(--tg-theme-hint-color)',
                    opacity: 0.7,
                  },
                },
              },
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              bottom: '12px',
              right: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'not-allowed',
              opacity: 0.5,
            }}
          >
            <AddPhotoAlternateIcon
              sx={{
                fontSize: '24px',
                color: 'var(--tg-theme-hint-color)',
              }}
            />
          </Box>
        </Box>

        <Button
          fullWidth
          variant="contained"
          onClick={handleGenerate}
          disabled={!description.trim() || isGenerating}
          className="generate-button"
          sx={{
            mt: 2,
            py: 1.5,
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: 600,
            textTransform: 'none',
            backgroundColor: '#ff6b35',
            color: '#ffffff',
            '&:hover': {
              backgroundColor: '#ff5722',
            },
            '&:disabled': {
              backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 40%, transparent)',
              color: 'var(--tg-theme-hint-color)',
            },
            transition: 'all 0.2s ease',
          }}
        >
          {isGenerating ? 'Генерируем...' : 'Нарисовать'}
        </Button>
      </Paper>
    </Box>
  );
};

export default GeneratePage;

