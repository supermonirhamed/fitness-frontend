import * as React from 'react';
/** Count bubble or dot — alerts count, waitlist "+3", unread. */
export interface BadgeProps { value?: React.ReactNode; severity?: 'primary' | 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast'; dot?: boolean; size?: 'sm' | 'md' | 'lg'; style?: React.CSSProperties }
export declare function Badge(props: BadgeProps): JSX.Element;
