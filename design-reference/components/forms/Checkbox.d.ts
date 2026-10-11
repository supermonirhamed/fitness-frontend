import * as React from 'react';
/** Checkbox — table row selection, consents, "skip this occurrence". */
export interface CheckboxProps { checked?: boolean; indeterminate?: boolean; onChange?: (checked: boolean) => void; label?: React.ReactNode; disabled?: boolean; invalid?: boolean; id?: string; size?: number }
export declare function Checkbox(props: CheckboxProps): JSX.Element;
