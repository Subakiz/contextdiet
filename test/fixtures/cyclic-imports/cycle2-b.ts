import { getA, InterfaceA } from './cycle2-a';

export interface InterfaceB {
  label: string;
  refA?: InterfaceA;
}

export function getB(): InterfaceB {
  return {
    label: 'B_node'
  };
}
