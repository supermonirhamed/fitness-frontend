import * as React from 'react';
/** Load failure: message + Retry. */
export interface ErrorStateProps { title?: React.ReactNode; message?: React.ReactNode; retryLabel?: string; onRetry?: (() => void) | null; compact?: boolean; style?: React.CSSProperties }
export declare function ErrorState(props: ErrorStateProps): JSX.Element;
