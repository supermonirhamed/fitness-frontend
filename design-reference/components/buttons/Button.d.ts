import * as React from 'react';
/**
 * PrimeVue-style Button. One primary per page; danger for destructive confirms.
 * @startingPoint section="Actions" subtitle="Primary, secondary, text, danger, icon-only, with badge" viewport="700x320"
 */
export interface ButtonProps {
  label?: string;
  children?: React.ReactNode;
  /** PrimeIcons class, e.g. "pi-plus". Add "pi-dir" for icons that flip in RTL. */
  icon?: string;
  iconPos?: 'start' | 'end';
  severity?: 'primary' | 'secondary' | 'success' | 'info' | 'warn' | 'danger' | 'help' | 'contrast';
  variant?: 'solid' | 'outlined' | 'text';
  size?: 'sm' | 'md' | 'lg';
  rounded?: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** Count bubble on the end-top corner */
  badge?: string | number;
  fullWidth?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  ariaLabel?: string;
  style?: React.CSSProperties;
  className?: string;
}
export declare function Button(props: ButtonProps): JSX.Element;
