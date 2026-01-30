import React, { useState } from 'react';
import { Box, Button, Card, CardContent, Typography, Switch, FormControlLabel } from '@mui/material';
import '@/styles/common.css';
import './DesignSystemDemo.css';

export const DesignSystemDemo: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  // Цвета из дизайн-системы
  const colors = [
    { name: 'Primary', var: '--color-primary', value: '#ee449f' },
    { name: 'Secondary', var: '--color-secondary', value: '#007aff' },
    { name: 'Background', var: '--color-background', value: '#191818' },
    { name: 'Surface', var: '--color-surface', value: '#262626' },
    { name: 'Surface Dark', var: '--color-surface-dark', value: '#2f2f2f' },
    { name: 'Text', var: '--color-text', value: '#ffffff' },
    { name: 'Text Secondary', var: '--color-text-secondary', value: '#8a8a8a' },
    { name: 'Success', var: '--color-success', value: '#00af12' },
    { name: 'Error', var: '--color-error', value: '#e03131' },
    { name: 'Border', var: '--color-border', value: '#8a8a8a' },
    { name: 'Overlay Light', var: '--color-overlay-light', value: 'rgba(255, 255, 255, 0.2)' },
    { name: 'Overlay Dark', var: '--color-overlay-dark', value: 'rgba(0, 0, 0, 0.5)' },
    { name: 'Overlay Primary', var: '--color-overlay-primary', value: 'rgba(238, 68, 159, 0.2)' },
  ];

  // Типографика
  const typography = [
    { name: 'H1', var: '--typography-h1', fontSize: '32px', fontWeight: 700, lineHeight: '43.71px' },
    { name: 'H2', var: '--typography-h2', fontSize: '20px', fontWeight: 700, lineHeight: '22px' },
    { name: 'H3', var: '--typography-h3', fontSize: '16px', fontWeight: 700, lineHeight: '22px' },
    { name: 'H4', var: '--typography-h4', fontSize: '16px', fontWeight: 800, lineHeight: '22px' },
    { name: 'Body', var: '--typography-body', fontSize: '16px', fontWeight: 400, lineHeight: '22px' },
    { name: 'Body Large', var: '--typography-body-large', fontSize: '18px', fontWeight: 400, lineHeight: '24.59px' },
    { name: 'Body Small', var: '--typography-body-small', fontSize: '12px', fontWeight: 400, lineHeight: '22px' },
    { name: 'Caption', var: '--typography-caption', fontSize: '8px', fontWeight: 400, lineHeight: '22px' },
    { name: 'Light', var: '--typography-light', fontSize: '12px', fontWeight: 300, lineHeight: '28px' },
  ];

  // Spacing
  const spacing = [
    { name: 'XS', var: '--spacing-xs', value: '4px' },
    { name: 'SM', var: '--spacing-sm', value: '8px' },
    { name: 'MD', var: '--spacing-md', value: '16px' },
    { name: 'LG', var: '--spacing-lg', value: '24px' },
    { name: 'XL', var: '--spacing-xl', value: '32px' },
    { name: '2XL', var: '--spacing-2xl', value: '48px' },
    { name: '3XL', var: '--spacing-3xl', value: '80px' },
  ];

  // Border Radius
  const borderRadius = [
    { name: 'SM', var: '--border-radius-sm', value: '8px' },
    { name: 'MD', var: '--border-radius-md', value: '10px' },
    { name: 'LG', var: '--border-radius-lg', value: '16px' },
    { name: 'XL', var: '--border-radius-xl', value: '24px' },
    { name: '2XL', var: '--border-radius-2xl', value: '30px' },
    { name: '3XL', var: '--border-radius-3xl', value: '31px' },
    { name: 'Full', var: '--border-radius-full', value: '32px' },
  ];

  return (
    <div className="page-container" data-theme={theme}>
      <Box sx={{ padding: 'var(--spacing-md)' }}>
        {/* Header */}
        <Box className="flex-row-center" sx={{ justifyContent: 'space-between', marginBottom: 'var(--spacing-xl)' }}>
          <Typography 
            variant="h1" 
            sx={{ 
              fontSize: 'var(--typography-h1-font-size)',
              fontWeight: 'var(--typography-h1-font-weight)',
              lineHeight: 'var(--typography-h1-line-height)',
              color: 'var(--color-text)'
            }}
          >
            Design System Demo
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={theme === 'dark'}
                onChange={toggleTheme}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: 'var(--color-primary)',
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: 'var(--color-primary)',
                  },
                }}
              />
            }
            label={theme === 'dark' ? 'Dark' : 'Light'}
            sx={{ color: 'var(--color-text)' }}
          />
        </Box>

        {/* Colors Section */}
        <Card className="card-base" sx={{ marginBottom: 'var(--spacing-lg)' }}>
          <CardContent>
            <Typography 
              variant="h2"
              sx={{ 
                fontSize: 'var(--typography-h2-font-size)',
                fontWeight: 'var(--typography-h2-font-weight)',
                marginBottom: 'var(--spacing-md)',
                color: 'var(--color-text)'
              }}
            >
              Colors
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--spacing-md)' }}>
              {colors.map((color) => (
                <Box key={color.name} sx={{ marginBottom: 'var(--spacing-sm)' }}>
                  <Box
                    sx={{
                      width: '100%',
                      height: '80px',
                      backgroundColor: `var(${color.var})`,
                      borderRadius: 'var(--border-radius-md)',
                      marginBottom: 'var(--spacing-xs)',
                      border: '1px solid var(--color-border)',
                    }}
                  />
                  <Typography 
                    sx={{ 
                      fontSize: 'var(--typography-body-small-font-size)',
                      fontWeight: 600,
                      color: 'var(--color-text)',
                      marginBottom: 'var(--spacing-xs)'
                    }}
                  >
                    {color.name}
                  </Typography>
                  <Typography 
                    sx={{ 
                      fontSize: 'var(--typography-caption-font-size)',
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'monospace'
                    }}
                  >
                    {color.var}
                  </Typography>
                  <Typography 
                    sx={{ 
                      fontSize: 'var(--typography-caption-font-size)',
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'monospace'
                    }}
                  >
                    {color.value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        {/* Typography Section */}
        <Card className="card-base" sx={{ marginBottom: 'var(--spacing-lg)' }}>
          <CardContent>
            <Typography 
              variant="h2"
              sx={{ 
                fontSize: 'var(--typography-h2-font-size)',
                fontWeight: 'var(--typography-h2-font-weight)',
                marginBottom: 'var(--spacing-md)',
                color: 'var(--color-text)'
              }}
            >
              Typography
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              {typography.map((type) => (
                <Box key={type.name} sx={{ padding: 'var(--spacing-sm)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--border-radius-sm)' }}>
                  <Typography 
                    sx={{ 
                      fontSize: type.fontSize,
                      fontWeight: type.fontWeight,
                      lineHeight: type.lineHeight,
                      color: 'var(--color-text)',
                      marginBottom: 'var(--spacing-xs)',
                      fontFamily: 'var(--font-family-base)'
                    }}
                  >
                    {type.name}: The quick brown fox jumps over the lazy dog
                  </Typography>
                  <Typography 
                    sx={{ 
                      fontSize: 'var(--typography-caption-font-size)',
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'monospace'
                    }}
                  >
                    {type.var} | {type.fontSize} | {type.fontWeight} | {type.lineHeight}
                  </Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        {/* Spacing Section */}
        <Card className="card-base" sx={{ marginBottom: 'var(--spacing-lg)' }}>
          <CardContent>
            <Typography 
              variant="h2"
              sx={{ 
                fontSize: 'var(--typography-h2-font-size)',
                fontWeight: 'var(--typography-h2-font-weight)',
                marginBottom: 'var(--spacing-md)',
                color: 'var(--color-text)'
              }}
            >
              Spacing
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              {spacing.map((space) => (
                <Box key={space.name} sx={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                  <Box
                    sx={{
                      width: `var(${space.var})`,
                      height: '40px',
                      backgroundColor: 'var(--color-primary)',
                      borderRadius: 'var(--border-radius-sm)',
                      minWidth: `var(${space.var})`,
                    }}
                  />
                  <Box>
                    <Typography 
                      sx={{ 
                        fontSize: 'var(--typography-body-small-font-size)',
                        fontWeight: 600,
                        color: 'var(--color-text)'
                      }}
                    >
                      {space.name}
                    </Typography>
                    <Typography 
                      sx={{ 
                        fontSize: 'var(--typography-caption-font-size)',
                        color: 'var(--color-text-secondary)',
                        fontFamily: 'monospace'
                      }}
                    >
                      {space.var} = {space.value}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        {/* Border Radius Section */}
        <Card className="card-base" sx={{ marginBottom: 'var(--spacing-lg)' }}>
          <CardContent>
            <Typography 
              variant="h2"
              sx={{ 
                fontSize: 'var(--typography-h2-font-size)',
                fontWeight: 'var(--typography-h2-font-weight)',
                marginBottom: 'var(--spacing-md)',
                color: 'var(--color-text)'
              }}
            >
              Border Radius
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 'var(--spacing-md)' }}>
              {borderRadius.map((radius) => (
                <Box key={radius.name} sx={{ textAlign: 'center' }}>
                  <Box
                    sx={{
                      width: '100px',
                      height: '100px',
                      backgroundColor: 'var(--color-primary)',
                      borderRadius: `var(${radius.var})`,
                      margin: '0 auto var(--spacing-sm)',
                      border: '1px solid var(--color-border)',
                    }}
                  />
                  <Typography 
                    sx={{ 
                      fontSize: 'var(--typography-body-small-font-size)',
                      fontWeight: 600,
                      color: 'var(--color-text)',
                      marginBottom: 'var(--spacing-xs)'
                    }}
                  >
                    {radius.name}
                  </Typography>
                  <Typography 
                    sx={{ 
                      fontSize: 'var(--typography-caption-font-size)',
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'monospace'
                    }}
                  >
                    {radius.var}
                  </Typography>
                  <Typography 
                    sx={{ 
                      fontSize: 'var(--typography-caption-font-size)',
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'monospace'
                    }}
                  >
                    {radius.value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        {/* Utility Classes Demo */}
        <Card className="card-base" sx={{ marginBottom: 'var(--spacing-lg)' }}>
          <CardContent>
            <Typography 
              variant="h2"
              sx={{ 
                fontSize: 'var(--typography-h2-font-size)',
                fontWeight: 'var(--typography-h2-font-weight)',
                marginBottom: 'var(--spacing-md)',
                color: 'var(--color-text)'
              }}
            >
              Utility Classes
            </Typography>
            
            {/* Flex Utilities */}
            <Box sx={{ marginBottom: 'var(--spacing-md)' }}>
              <Typography 
                variant="h3"
                sx={{ 
                  fontSize: 'var(--typography-h3-font-size)',
                  fontWeight: 'var(--typography-h3-font-weight)',
                  marginBottom: 'var(--spacing-sm)',
                  color: 'var(--color-text)'
                }}
              >
                Flex Utilities
              </Typography>
              <Box className="flex-center" sx={{ padding: 'var(--spacing-md)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--border-radius-sm)', marginBottom: 'var(--spacing-sm)' }}>
                <Typography sx={{ color: 'var(--color-text)' }}>.flex-center</Typography>
              </Box>
              <Box className="flex-column-center" sx={{ padding: 'var(--spacing-md)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--border-radius-sm)', marginBottom: 'var(--spacing-sm)' }}>
                <Typography sx={{ color: 'var(--color-text)' }}>.flex-column-center</Typography>
              </Box>
              <Box className="flex-row-center" sx={{ padding: 'var(--spacing-md)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--border-radius-sm)' }}>
                <Typography sx={{ color: 'var(--color-text)' }}>.flex-row-center</Typography>
              </Box>
            </Box>

            {/* Text Utilities */}
            <Box sx={{ marginBottom: 'var(--spacing-md)' }}>
              <Typography 
                variant="h3"
                sx={{ 
                  fontSize: 'var(--typography-h3-font-size)',
                  fontWeight: 'var(--typography-h3-font-weight)',
                  marginBottom: 'var(--spacing-sm)',
                  color: 'var(--color-text)'
                }}
              >
                Text Utilities
              </Typography>
              <Box sx={{ padding: 'var(--spacing-md)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--border-radius-sm)' }}>
                <Typography className="text-primary" sx={{ marginBottom: 'var(--spacing-xs)' }}>.text-primary</Typography>
                <Typography className="text-hint" sx={{ marginBottom: 'var(--spacing-xs)' }}>.text-hint</Typography>
                <Typography className="text-default" sx={{ marginBottom: 'var(--spacing-xs)' }}>.text-default</Typography>
                <Typography className="text-center" sx={{ color: 'var(--color-text)' }}>.text-center</Typography>
              </Box>
            </Box>

            {/* Button Utilities */}
            <Box>
              <Typography 
                variant="h3"
                sx={{ 
                  fontSize: 'var(--typography-h3-font-size)',
                  fontWeight: 'var(--typography-h3-font-weight)',
                  marginBottom: 'var(--spacing-sm)',
                  color: 'var(--color-text)'
                }}
              >
                Button Styles
              </Typography>
              <Box sx={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                <Button 
                  className="button-base button-rounded-sm"
                  sx={{ 
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-text)',
                    padding: 'var(--spacing-sm) var(--spacing-md)'
                  }}
                >
                  Rounded SM
                </Button>
                <Button 
                  className="button-base button-rounded-md"
                  sx={{ 
                    backgroundColor: 'var(--color-secondary)',
                    color: 'var(--color-text)',
                    padding: 'var(--spacing-sm) var(--spacing-md)'
                  }}
                >
                  Rounded MD
                </Button>
                <Button 
                  className="button-base button-rounded-lg"
                  sx={{ 
                    backgroundColor: 'var(--color-success)',
                    color: 'var(--color-text)',
                    padding: 'var(--spacing-sm) var(--spacing-md)'
                  }}
                >
                  Rounded LG
                </Button>
                <Button 
                  className="button-base button-rounded"
                  sx={{ 
                    backgroundColor: 'var(--color-error)',
                    color: 'var(--color-text)',
                    padding: 'var(--spacing-sm) var(--spacing-md)'
                  }}
                >
                  Rounded Full
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </div>
  );
};
