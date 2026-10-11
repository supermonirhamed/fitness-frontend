import * as React from 'react';
/** Single-choice dropdown. Disabled options carry a `sub` line explaining why (e.g. "Busy 18:00–19:00"). */
export interface SelectOption { label: string; value: string; icon?: string; sub?: string; meta?: string; disabled?: boolean }
export interface SelectProps {
  options: SelectOption[]; value?: string; onChange?: (value: string) => void; placeholder?: string;
  invalid?: boolean; disabled?: boolean; size?: 'sm' | 'md' | 'lg'; icon?: string; id?: string; style?: React.CSSProperties;
  renderOption?: (o: SelectOption) => React.ReactNode;
}
export declare function Select(props: SelectProps): JSX.Element;
