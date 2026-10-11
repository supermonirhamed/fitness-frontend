import * as React from 'react';
/** Yes/no confirmation. Use severity="danger" for destructive actions; state the impact in `message`. */
export interface ConfirmDialogProps { visible?: boolean; header: React.ReactNode; message?: React.ReactNode; detail?: React.ReactNode; severity?: 'default' | 'danger'; icon?: string; acceptLabel?: string; rejectLabel?: string; onAccept?: () => void; onReject?: () => void; inline?: boolean; acceptDisabled?: boolean }
export declare function ConfirmDialog(props: ConfirmDialogProps): JSX.Element | null;
