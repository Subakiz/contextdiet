import { stepC } from './cycle3-c';

export interface ContractB {
  description: string;
}

export function stepB(): string {
  return `B -> ${stepC()}`;
}
