import * as React from 'react';
/** Radio — edit scope ("This session only / This and following / All in series"), each with a one-line description. */
export interface RadioButtonProps { name: string; value: string; checked?: boolean; onChange?: (value: string) => void; label?: React.ReactNode; description?: React.ReactNode; disabled?: boolean; id?: string }
export declare function RadioButton(props: RadioButtonProps): JSX.Element;
