import * as React from 'react';
/** Inline info / warn / error message inside a form, drawer or page. */
export interface MessageProps {
  severity?: 'info' | 'success' | 'warn' | 'danger' | 'secondary' | 'contrast';
  title?: string;
  children?: React.ReactNode;
  icon?: string;
  closable?: boolean;
  onClose?: () => void;
  /** Trailing action, e.g. an "Override capacity" Button */
  action?: React.ReactNode;
  variant?: 'subtle' | 'solid';
  style?: React.CSSProperties;
}
export declare function Message(props: MessageProps): JSX.Element;
