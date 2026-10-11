import * as React from 'react';
/** Side panel for quick create/edit. Opens on the END side: right in LTR, left in RTL. Sticky footer for Cancel / Save. */
export interface DrawerProps { visible?: boolean; onHide?: () => void; header?: React.ReactNode; subheader?: React.ReactNode; children?: React.ReactNode; footer?: React.ReactNode; position?: 'end' | 'start'; width?: number | string; /** contain within nearest positioned parent (for previews) */ inline?: boolean; modal?: boolean }
export declare function Drawer(props: DrawerProps): JSX.Element | null;
