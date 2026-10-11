import * as React from 'react';
/** On/off setting — waitlist on, notify clients, family permissions. Knob moves to the inline-end in both directions. */
export interface ToggleSwitchProps { checked?: boolean; onChange?: (checked: boolean) => void; label?: React.ReactNode; description?: React.ReactNode; disabled?: boolean; id?: string }
export declare function ToggleSwitch(props: ToggleSwitchProps): JSX.Element;
