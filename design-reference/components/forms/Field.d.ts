import * as React from 'react';
/** Label + control + help/error line. Wrap every form control with it. */
export interface FieldProps { label?: string; htmlFor?: string; required?: boolean; help?: React.ReactNode; error?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties }
export declare function Field(props: FieldProps): JSX.Element;
