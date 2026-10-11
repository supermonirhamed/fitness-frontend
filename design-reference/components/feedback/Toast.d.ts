import * as React from 'react';
/** Transient confirmation after an action (e.g. booking confirmed). Position the stack bottom-end. */
export interface ToastProps {
  severity?: 'success' | 'info' | 'warn' | 'danger';
  summary: string;
  detail?: React.ReactNode;
  /** e.g. text Buttons "View booking", "Book another" */
  actions?: React.ReactNode;
  onClose?: () => void;
  style?: React.CSSProperties;
}
export declare function Toast(props: ToastProps): JSX.Element;
