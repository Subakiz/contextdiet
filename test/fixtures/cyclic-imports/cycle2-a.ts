import { getB } from './cycle2-b';

export interface InterfaceA {
  name: string;
  count: number;
}

export function getA(): InterfaceA {
  const b = getB();
  return {
    name: `A_linked_to_${b.label}`,
    count: 10
  };
}
