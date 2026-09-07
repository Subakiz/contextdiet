/**
 * User domain models and authentication types for ts-service.
 */

export type UserRole = 'customer' | 'admin' | 'merchant' | 'support';

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefaultShipping: boolean;
}

export interface UserPreferences {
  currency: string;
  marketingOptIn: boolean;
  twoFactorEnabled: boolean;
  notificationChannels: Array<'email' | 'sms' | 'push'>;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  addresses: Address[];
  preferences: UserPreferences;
  isActive: boolean;
}

export interface UserCreateInput {
  email: string;
  displayName: string;
  role?: UserRole;
  addresses?: Address[];
}

export interface UserUpdateInput {
  displayName?: string;
  addresses?: Address[];
  preferences?: Partial<UserPreferences>;
  isActive?: boolean;
}
