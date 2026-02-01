import type { ReactNode } from 'react';
import styles from './MilitaryButton.module.css';

interface MilitaryButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'default' | 'primary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  info?: string;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  /** Forwarded ref for focus management */
  buttonRef?: React.Ref<HTMLButtonElement>;
  /** Accessible label for screen readers */
  ariaLabel?: string;
  /** ID of element that describes this button */
  ariaDescribedBy?: string;
}

export function MilitaryButton({
  children,
  onClick,
  disabled = false,
  variant = 'default',
  size = 'md',
  icon,
  info,
  className = '',
  type = 'button',
  buttonRef,
  ariaLabel,
  ariaDescribedBy,
}: MilitaryButtonProps) {
  const sizeClass = size !== 'md' ? styles[size] : '';
  const variantClass = variant !== 'default' ? styles[variant] : '';

  return (
    <button
      ref={buttonRef}
      type={type}
      className={`${styles.button} ${sizeClass} ${variantClass} ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-disabled={disabled}
    >
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      {info ? (
        <span className={styles.content}>
          <span>{children}</span>
          <span className={styles.info} aria-hidden="true">
            {info}
          </span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
