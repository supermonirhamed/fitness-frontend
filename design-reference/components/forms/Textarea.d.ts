import * as React from 'react';
/** Multi-line text — notes, override reasons. */
export interface TextareaProps { value?: string; onChange?: (value: string) => void; placeholder?: string; rows?: number; invalid?: boolean; disabled?: boolean; maxLength?: number; id?: string; style?: React.CSSProperties }
export declare function Textarea(props: TextareaProps): JSX.Element;
