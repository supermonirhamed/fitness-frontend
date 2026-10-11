/** Segmented single/multi choice — view switch, payment source, payment method. */
export interface SelectButtonOption { label: string; value: string; icon?: string; disabled?: boolean; /** Shown next to disabled options, e.g. "Coming soon" */ hint?: string }
export interface SelectButtonProps {
  options: SelectButtonOption[];
  value?: string | string[];
  onChange?: (value: any) => void;
  multiple?: boolean;
  fullWidth?: boolean;
  ariaLabel?: string;
}
export declare function SelectButton(props: SelectButtonProps): JSX.Element;
