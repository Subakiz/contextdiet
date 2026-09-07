export type Primitive = string | number | boolean | null | undefined;

export interface BaseEntity {
  id: string;
  createdAt: Date;
}

export interface UserDTO extends BaseEntity {
  username: string;
  email: string;
  roles: Array<'admin' | 'member'>;
}

export type ReadonlyRecord<K extends string, V> = {
  readonly [P in K]: V;
};
