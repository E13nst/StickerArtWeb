import React from 'react';
import { Box, Typography } from '@mui/material';

// Объявляем глобальные переменные, определенные в vite.config.ts
declare const __BUILD_TIME__: string;
declare const __COMMIT_HASH__: string;
declare const __APP_VERSION__: string;

interface BuildInfoProps {
  showInConsole?: boolean;
  showInUI?: boolean;
}

export const BuildInfo: React.FC<BuildInfoProps> = ({ 
  showInConsole = true, 
  showInUI = false 
}) => {
  const buildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'unknown';
  const commitHash = typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : 'unknown';
  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown';

  React.useEffect(() => {
    if (showInConsole) {
      console.log('🏗️ Build Info:', {
        version: appVersion,
        buildTime: buildTime,
        commitHash: commitHash,
        timestamp: new Date().toISOString()
      });
    }
  }, [showInConsole, appVersion, buildTime, commitHash]);

  if (!showInUI) {
    return null;
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '10px',
        fontFamily: 'monospace',
        zIndex: 9999,
        pointerEvents: 'none'
      }}
    >
      <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.2 }}>
        v{appVersion}
      </Typography>
      <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.2 }}>
        {new Date(buildTime).toLocaleString()}
      </Typography>
      {commitHash !== 'unknown' && commitHash !== 'local-dev' && (
        <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.2 }}>
          {commitHash.substring(0, 7)}
        </Typography>
      )}
    </Box>
  );
};
