import React from 'react';

export type TextVariant = 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'bodySmall' | 'caption' | 'label';
export type TextWeight = 'bold' | 'semibold' | 'regular' | 'light';
export type TextColor = 'primary' | 'secondary' | 'hint' | 'default';
export type TextAlign = 'left' | 'center' | 'right';

export interface TextProps extends React.HTMLAttributes<HTMLElement> {
  variant?: TextVariant;
  weight?: TextWeight;
  color?: TextColor;
  align?: TextAlign;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  as?: keyof JSX.IntrinsicElements;
}

const variantToElement: Record<TextVariant, keyof JSX.IntrinsicElements> = {
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  body: 'p',
  bodySmall: 'p',
  caption: 'span',
  label: 'span',
};

export const Text: React.FC<TextProps> = ({
  variant = 'body',
  weight,
  color = 'default',
  align,
  children,
  className = '',
  style,
  as,
  ...rest
}) => {
  const Element = as || variantToElement[variant];
  
  const classes = [
    `text-${variant}`,
    weight && `text-${weight}`,
    color && `text-${color}`,
    align && `text-${align}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const props: React.HTMLAttributes<HTMLElement> = {
    className: classes,
    style,
    ...rest,
  };

  return React.createElement(Element, props, children);
};

export default Text;
