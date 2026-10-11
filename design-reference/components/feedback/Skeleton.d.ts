import * as React from 'react';
/** Loading placeholder — compose Skeletons that match the final layout; never use full-page spinners. */
export interface SkeletonProps { width?: number | string; height?: number | string; shape?: 'rect' | 'circle'; radius?: number | string; style?: React.CSSProperties }
export declare function Skeleton(props: SkeletonProps): JSX.Element;
