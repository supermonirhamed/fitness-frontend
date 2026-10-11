import * as React from 'react';
/** Required-reason dialog used by every override and destructive action (audited). */
export interface OverrideDialogProps { visible?: boolean; title?: React.ReactNode; description?: React.ReactNode; /** if given, a required Select; otherwise the note is required */ reasons?: { label: string; value: string }[]; destructive?: boolean; confirmLabel?: string; cancelLabel?: string; reasonLabel?: string; auditNote?: string; onConfirm?: (v: { reason: string; note: string }) => void; onCancel?: () => void; inline?: boolean }
export declare function OverrideDialog(props: OverrideDialogProps): JSX.Element | null;
