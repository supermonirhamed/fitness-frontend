import * as React from 'react';
/** Who/what/when list of conflicts. Hard (red) blocks Save; soft (amber) needs confirmation. */
export interface ConflictItem { level: 'hard' | 'soft'; title: React.ReactNode; who?: string; when?: string; href?: string; linkLabel?: string; onOpen?: () => void }
export interface ConflictListProps { items: ConflictItem[]; style?: React.CSSProperties }
export declare function ConflictList(props: ConflictListProps): JSX.Element;
