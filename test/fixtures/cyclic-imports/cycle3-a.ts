import { stepB } from './cycle3-b';

export interface ContractA {
  version: number;
}

export function stepA(): string {
  return `A -> ${stepB()}`;
}
