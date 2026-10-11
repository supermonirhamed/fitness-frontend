import * as React from 'react';
/** Compact label with severity colour. For entity statuses prefer StatusTag, which maps status → severity. */
export interface TagProps { value?: React.ReactNode; children?: React.ReactNode; severity?: 'success' | 'info' | 'warn' | 'danger' | 'help' | 'secondary' | 'contrast'; icon?: string; rounded?: boolean; strike?: boolean; size?: 'sm' | 'md'; style?: React.CSSProperties }
export declare function Tag(props: TagProps): JSX.Element;
