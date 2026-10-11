import * as React from 'react';
/** Appears above a DataTable when rows are selected (Add tag, Cancel, Mark attended, Export). Pass contrast/secondary Buttons. */
export interface BulkActionBarProps { count: number; label?: React.ReactNode; actions?: React.ReactNode; onClear?: () => void; clearLabel?: string; style?: React.CSSProperties }
export declare function BulkActionBar(props: BulkActionBarProps): JSX.Element | null;
