import * as React from 'react';
/** Shown when a user opens a URL they can't access. Fixed copy in AR/EN. */
export interface NoPermissionProps { lang?: 'en' | 'ar'; action?: React.ReactNode; style?: React.CSSProperties }
export declare function NoPermission(props: NoPermissionProps): JSX.Element;
