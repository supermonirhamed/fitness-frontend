import * as React from 'react';
/** Activity / audit timeline — the last tab of every detail page. Dots use status/severity colours. */
export interface TimelineEvent { title: React.ReactNode; time?: string; description?: React.ReactNode; severity?: 'success' | 'info' | 'warn' | 'danger' | 'help' | 'secondary'; icon?: string; /** voided payments etc. */ strike?: boolean }
export interface TimelineProps { events: TimelineEvent[]; style?: React.CSSProperties }
export declare function Timeline(props: TimelineProps): JSX.Element;
