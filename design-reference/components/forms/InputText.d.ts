import * as React from 'react';
/** Single-line text input. Use `icon="pi-search"` for search fields; `dir="ltr"` for phone/email inside RTL forms. */
export interface InputTextProps {
  value?: string; onChange?: (value: string, e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string;
  icon?: string; iconEnd?: string; prefix?: React.ReactNode; suffix?: React.ReactNode;
  invalid?: boolean; disabled?: boolean; size?: 'sm' | 'md' | 'lg'; type?: string; id?: string; name?: string; autoFocus?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; dir?: 'ltr' | 'rtl' | 'auto'; style?: React.CSSProperties;
}
export declare function InputText(props: InputTextProps): JSX.Element;
