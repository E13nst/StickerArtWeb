import { FC } from 'react';
import { Text } from '@/components/ui/Text';
import './MetricCard.css';

interface MetricCardProps {
  title: string;
  value: number | string;
  trend?: string;
  period?: string;
  icon?: string;
  color?: string;
}

export const MetricCard: FC<MetricCardProps> = ({
  title,
  value,
  trend,
  period,
  icon,
  color = 'var(--color-button)'
}) => {
  return (
    <div className="metric-card card-base">
      <div className="metric-card-header">
        <Text variant="caption" color="hint" className="metric-card-title">
          {title}
        </Text>
        {icon && <span className="metric-card-icon">{icon}</span>}
      </div>
      
      <Text 
        variant="h2" 
        weight="bold" 
        className="metric-card-value"
        style={{ color }}
      >
        {typeof value === 'number' ? value.toLocaleString('ru-RU') : value}
      </Text>

      {trend && period && (
        <Text 
          variant="caption" 
          className="metric-card-trend"
          style={{
            color: trend.startsWith('+') 
              ? 'var(--color-button)' 
              : 'var(--color-text-secondary)'
          }}
        >
          {trend} за {period}
        </Text>
      )}
    </div>
  );
};
