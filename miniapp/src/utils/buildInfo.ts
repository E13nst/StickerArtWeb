// Утилита для получения информации о сборке
export interface BuildInfo {
  version: string;
  buildTime: string;
  mode: string;
  nodeEnv: string;
}

export const getBuildInfo = (): BuildInfo => {
  return {
    version: import.meta.env.VITE_APP_VERSION || '1.0.0',
    buildTime: import.meta.env.VITE_BUILD_TIME || 'Неизвестно',
    mode: import.meta.env.MODE,
    nodeEnv: import.meta.env.NODE_ENV || 'development'
  };
};

export const formatBuildTime = (buildTime: string): string => {
  if (buildTime === 'Неизвестно') {
    return buildTime;
  }
  
  try {
    return new Date(buildTime).toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (error) {
    console.warn('Failed to format build time:', error);
    return buildTime;
  }
};
