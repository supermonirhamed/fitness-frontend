import * as React from 'react';
/** Icon + one-line explanation + primary action. e.g. "No sessions today at Olaya branch". */
export interface EmptyStateProps { icon?: string; title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; compact?: boolean; style?: React.CSSProperties }
export declare function EmptyState(props: EmptyStateProps): JSX.Element;
