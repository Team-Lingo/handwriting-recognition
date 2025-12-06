import React from 'react';
import './LoadingButton.css';

interface LoadingButtonProps {
  children: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'success' | 'danger';
  size?: 'small' | 'normal' | 'large';
  fullWidth?: boolean;
  rounded?: boolean;
  spinnerType?: 'riot' | 'hexagon' | 'dots';
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

export default function LoadingButton({
  children,
  onClick,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'normal',
  fullWidth = false,
  rounded = false,
  spinnerType = 'riot',
  type = 'button',
  className = '',
  ...props
}: LoadingButtonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const buttonClasses = [
    'loading-button',
    variant,
    size,
    fullWidth && 'full-width',
    rounded && 'rounded',
    loading && 'loading',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const renderSpinner = () => {
    switch (spinnerType) {
      case 'hexagon':
        return <div className="hexagon-spinner"></div>;

      case 'dots':
        return (
          <div className="dots-spinner">
            <div></div>
            <div></div>
            <div></div>
          </div>
        );

      case 'riot':
      default:
        return <div className="riot-spinner"></div>;
    }
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading || disabled}
      className={buttonClasses}
      {...props}
    >
      <span className="button-text">{children}</span>

      {loading && (
        <>
          <div className="loading-spinner">{renderSpinner()}</div>
          <div className="riot-progress"></div>
          <div className="downloading-bar"></div>
          <div className="loading-pulse"></div>
        </>
      )}
    </button>
  );
}
