import React from 'react';

export interface AuthRequiredCTAProps {
  description: string;
  buttonText: string;
  icon?: string;
  onRetry: () => void;
}

export const AuthRequiredCTA: React.FC<AuthRequiredCTAProps> = ({
  description,
  buttonText,
  icon,
  onRetry,
}) => (
  <div className="auth-required-cta">
    {icon && <span className="auth-required-cta__icon" aria-hidden>{icon}</span>}
    <p className="auth-required-cta__description">{description}</p>
    <button type="button" className="auth-required-cta__button" onClick={onRetry}>
      {buttonText}
    </button>
  </div>
);
