import { stepA } from './cycle3-a';

export interface ContractC {
  timestamp: number;
}

export function stepC(): string {
  return `C -> loop`;
}
