/** Multi-step flows: series preview, import clients, tenant provisioning. */
export interface StepperStep { label: string; description?: string }
export interface StepperProps { steps: StepperStep[]; active?: number; onStepClick?: (index: number) => void; orientation?: 'horizontal' | 'vertical' }
export declare function Stepper(props: StepperProps): JSX.Element;
