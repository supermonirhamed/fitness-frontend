import * as React from 'react';
/** Centered modal for focused decisions (edit scope, record payment). */
export interface DialogProps { visible?: boolean; onHide?: () => void; header?: React.ReactNode; children?: React.ReactNode; footer?: React.ReactNode; width?: number | string; inline?: boolean; closable?: boolean }
export declare function Dialog(props: DialogProps): JSX.Element | null;
