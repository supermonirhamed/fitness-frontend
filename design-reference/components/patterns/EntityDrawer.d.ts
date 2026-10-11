import * as React from 'react';
/**
 * Create/edit form in a Drawer with sticky Cancel / Save footer.
 * @startingPoint section="Patterns" subtitle="Create / edit drawer with sticky footer" viewport="900x560"
 */
export interface EntityDrawerProps { visible?: boolean; title: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode; onCancel?: () => void; onSave?: () => void; saveLabel?: string; cancelLabel?: string; saving?: boolean; saveDisabled?: boolean; /** e.g. conflict summary */ footerStart?: React.ReactNode; width?: number | string; inline?: boolean }
export declare function EntityDrawer(props: EntityDrawerProps): JSX.Element | null;
