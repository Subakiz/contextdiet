import { add } from '@/utils/math';

export interface ButtonProps {
  label: string;
  onClick: () => void;
}

export function renderButton(props: ButtonProps): string {
  const padding = add(8, 4);
  return `<button style="padding: ${padding}px">${props.label}</button>`;
}
