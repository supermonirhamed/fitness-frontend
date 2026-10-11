import * as React from 'react';
/** Multiple choice dropdown — filters (coach, facility, status), tags. */
export interface MultiSelectOption { label: string; value: string; color?: string; disabled?: boolean }
export interface MultiSelectProps { options: MultiSelectOption[]; value?: string[]; onChange?: (value: string[]) => void; placeholder?: string; display?: 'chip' | 'comma'; maxChips?: number; filter?: boolean; invalid?: boolean; disabled?: boolean; id?: string; style?: React.CSSProperties }
export declare function MultiSelect(props: MultiSelectProps): JSX.Element;
