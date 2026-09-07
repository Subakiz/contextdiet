import { loopMe } from './self-cycle';

export function loopMe(n: number): number {
  if (n <= 0) return 0;
  return loopMe(n - 1);
}
