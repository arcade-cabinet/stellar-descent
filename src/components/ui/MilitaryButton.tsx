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
    >
      {icon && <span className={styles.icon}>{icon}</span>}
      {info ? (
        <span className={styles.content}>
          <span>{children}</span>
          <span className={styles.info}>{info}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
