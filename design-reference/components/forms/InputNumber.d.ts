import * as React from 'react';
/** Numeric input for currency, percentage (VAT) and minutes (duration). Always Western digits, LTR. */
export interface InputNumberProps {
  value?: number | null; onChange?: (value: number | null) => void;
  mode?: 'decimal' | 'currency' | 'percent' | 'minutes'; currency?: string; unitLabel?: string;
  min?: number; max?: number; step?: number; decimals?: number; showButtons?: boolean;
  invalid?: boolean; disabled?: boolean; size?: 'sm' | 'md' | 'lg'; placeholder?: string; id?: string; style?: React.CSSProperties;
}
export declare function InputNumber(props: InputNumberProps): JSX.Element;
