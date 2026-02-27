import { FC } from 'react';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { OtherAccountBackground } from '@/components/OtherAccountBackground';
import '@/styles/common.css';
import './DesignSystemDemo.css';

export const DesignSystemDemo: FC = () => {

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
    { name: 'H1', variant: 'h1' as const, example: 'The quick brown fox jumps over the lazy dog' },
    { name: 'H2', variant: 'h2' as const, example: 'The quick brown fox jumps over the lazy dog' },
    { name: 'H3', variant: 'h3' as const, example: 'The quick brown fox jumps over the lazy dog' },
    { name: 'H4', variant: 'h4' as const, example: 'The quick brown fox jumps over the lazy dog' },
    { name: 'Body', variant: 'body' as const, example: 'The quick brown fox jumps over the lazy dog' },
    { name: 'Body Small', variant: 'bodySmall' as const, example: 'The quick brown fox jumps over the lazy dog' },
    { name: 'Caption', variant: 'caption' as const, example: 'The quick brown fox jumps over the lazy dog' },
    { name: 'Label', variant: 'label' as const, example: 'The quick brown fox jumps over the lazy dog' },
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
    <div className="page-container">
      <OtherAccountBackground />
      <div style={{ padding: 'var(--spacing-md)' }}>
        {/* Header */}
        <div className="flex-row-center" style={{ justifyContent: 'space-between', marginBottom: 'var(--spacing-xl)' }}>
          <Text variant="h1" weight="bold" color="default">
            Design System Demo
          </Text>
        </div>

        {/* Colors Section */}
        <div className="card-base" style={{ marginBottom: 'var(--spacing-lg)', padding: 'var(--spacing-md)' }}>
          <Text variant="h2" weight="bold" color="default" style={{ marginBottom: 'var(--spacing-md)' }}>
            Colors
          </Text>
          <div className="color-grid">
            {colors.map((color) => (
              <div key={color.name} className="color-item">
                <div
                  className="color-swatch"
                  style={{
                    backgroundColor: `var(${color.var})`,
                  }}
                />
                <Text variant="bodySmall" weight="semibold" color="default" style={{ marginBottom: '4px' }}>
                  {color.name}
                </Text>
                <Text variant="caption" color="hint" style={{ fontFamily: 'monospace' }}>
                  {color.var}
                </Text>
                <Text variant="caption" color="hint" style={{ fontFamily: 'monospace' }}>
                  {color.value}
                </Text>
              </div>
            ))}
          </div>
        </div>

        {/* Typography Section */}
        <div className="card-base" style={{ marginBottom: 'var(--spacing-lg)', padding: 'var(--spacing-md)' }}>
          <Text variant="h2" weight="bold" color="default" style={{ marginBottom: 'var(--spacing-md)' }}>
            Typography
          </Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            {typography.map((type) => (
              <div 
                key={type.name} 
                style={{ 
                  padding: 'var(--spacing-sm)', 
                  backgroundColor: 'var(--color-surface)', 
                  borderRadius: 'var(--border-radius-sm)' 
                }}
              >
                <Text variant={type.variant} color="default" style={{ marginBottom: '4px' }}>
                  {type.name}: {type.example}
                </Text>
                <Text variant="caption" color="hint" style={{ fontFamily: 'monospace' }}>
                  variant="{type.variant}"
                </Text>
              </div>
            ))}
          </div>
        </div>

        {/* Buttons Section */}
        <div className="card-base" style={{ marginBottom: 'var(--spacing-lg)', padding: 'var(--spacing-md)' }}>
          <Text variant="h2" weight="bold" color="default" style={{ marginBottom: 'var(--spacing-md)' }}>
            Buttons
          </Text>
          
          <div style={{ marginBottom: 'var(--spacing-lg)' }}>
            <Text variant="h3" weight="semibold" color="default" style={{ marginBottom: 'var(--spacing-sm)' }}>
              Variants
            </Text>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
              <Button variant="primary" size="medium">Primary</Button>
              <Button variant="secondary" size="medium">Secondary</Button>
              <Button variant="outline" size="medium">Outline</Button>
              <Button variant="ghost" size="medium">Ghost</Button>
            </div>
          </div>

          <div style={{ marginBottom: 'var(--spacing-lg)' }}>
            <Text variant="h3" weight="semibold" color="default" style={{ marginBottom: 'var(--spacing-sm)' }}>
              Sizes
            </Text>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap', alignItems: 'center' }}>
              <Button variant="primary" size="small">Small</Button>
              <Button variant="primary" size="medium">Medium</Button>
              <Button variant="primary" size="large">Large</Button>
            </div>
          </div>

          <div>
            <Text variant="h3" weight="semibold" color="default" style={{ marginBottom: 'var(--spacing-sm)' }}>
              States
            </Text>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
              <Button variant="primary" size="medium">Normal</Button>
              <Button variant="primary" size="medium" disabled>Disabled</Button>
              <Button variant="primary" size="medium" loading>Loading</Button>
            </div>
          </div>
        </div>

        {/* Spacing Section */}
        <div className="card-base" style={{ marginBottom: 'var(--spacing-lg)', padding: 'var(--spacing-md)' }}>
          <Text variant="h2" weight="bold" color="default" style={{ marginBottom: 'var(--spacing-md)' }}>
            Spacing
          </Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            {spacing.map((space) => (
              <div key={space.name} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                <div
                  style={{
                    width: `var(${space.var})`,
                    height: '40px',
                    backgroundColor: 'var(--color-primary)',
                    borderRadius: 'var(--border-radius-sm)',
                    minWidth: `var(${space.var})`,
                  }}
                />
                <div>
                  <Text variant="bodySmall" weight="semibold" color="default">
                    {space.name}
                  </Text>
                  <Text variant="caption" color="hint" style={{ fontFamily: 'monospace' }}>
                    {space.var} = {space.value}
                  </Text>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Border Radius Section */}
        <div className="card-base" style={{ marginBottom: 'var(--spacing-lg)', padding: 'var(--spacing-md)' }}>
          <Text variant="h2" weight="bold" color="default" style={{ marginBottom: 'var(--spacing-md)' }}>
            Border Radius
          </Text>
          <div className="radius-grid">
            {borderRadius.map((radius) => (
              <div key={radius.name} style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: '100px',
                    height: '100px',
                    backgroundColor: 'var(--color-primary)',
                    borderRadius: `var(${radius.var})`,
                    margin: '0 auto var(--spacing-sm)',
                    border: '1px solid var(--color-border)',
                  }}
                />
                <Text variant="bodySmall" weight="semibold" color="default" style={{ marginBottom: '4px' }}>
                  {radius.name}
                </Text>
                <Text variant="caption" color="hint" style={{ fontFamily: 'monospace' }}>
                  {radius.var}
                </Text>
                <Text variant="caption" color="hint" style={{ fontFamily: 'monospace' }}>
                  {radius.value}
                </Text>
              </div>
            ))}
          </div>
        </div>

        {/* Utility Classes Demo */}
        <div className="card-base" style={{ marginBottom: 'var(--spacing-lg)', padding: 'var(--spacing-md)' }}>
          <Text variant="h2" weight="bold" color="default" style={{ marginBottom: 'var(--spacing-md)' }}>
            Utility Classes
          </Text>
          
          {/* Flex Utilities */}
          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <Text variant="h3" weight="semibold" color="default" style={{ marginBottom: 'var(--spacing-sm)' }}>
              Flex Utilities
            </Text>
            <div className="flex-center" style={{ padding: 'var(--spacing-md)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--border-radius-sm)', marginBottom: 'var(--spacing-sm)' }}>
              <Text variant="body" color="default">.flex-center</Text>
            </div>
            <div className="flex-column-center" style={{ padding: 'var(--spacing-md)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--border-radius-sm)', marginBottom: 'var(--spacing-sm)' }}>
              <Text variant="body" color="default">.flex-column-center</Text>
            </div>
            <div className="flex-row-center" style={{ padding: 'var(--spacing-md)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--border-radius-sm)' }}>
              <Text variant="body" color="default">.flex-row-center</Text>
            </div>
          </div>

          {/* Text Utilities */}
          <div>
            <Text variant="h3" weight="semibold" color="default" style={{ marginBottom: 'var(--spacing-sm)' }}>
              Text Utilities
            </Text>
            <div style={{ padding: 'var(--spacing-md)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--border-radius-sm)' }}>
              <Text variant="body" color="primary" style={{ marginBottom: 'var(--spacing-xs)' }}>
                color="primary"
              </Text>
              <Text variant="body" color="secondary" style={{ marginBottom: 'var(--spacing-xs)' }}>
                color="secondary"
              </Text>
              <Text variant="body" color="hint" style={{ marginBottom: 'var(--spacing-xs)' }}>
                color="hint"
              </Text>
              <Text variant="body" color="default">
                color="default"
              </Text>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
