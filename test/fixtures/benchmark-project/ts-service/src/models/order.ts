/**
 * Order domain models, statuses, and pricing types.
 */

import { User, Address } from './user';

export type OrderStatus =
  | 'pending'
  | 'payment_processing'
  | 'paid'
  | 'fulfillment_in_progress'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export interface OrderItem {
  id: string;
  sku: string;
  title: string;
  unitPriceCents: number;
  quantity: number;
  taxCode: string;
  discountCents?: number;
}

export interface OrderPricing {
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalDiscountCents: number;
  totalCents: number;
  currency: string;
}

export interface OrderAuditLog {
  timestamp: Date;
  previousStatus: OrderStatus | null;
  newStatus: OrderStatus;
  actorId: string;
  note?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customer: Pick<User, 'id' | 'email' | 'displayName'>;
  items: OrderItem[];
  pricing: OrderPricing;
  shippingAddress: Address;
  status: OrderStatus;
  paymentIntentId?: string;
  trackingNumber?: string;
  auditTrail: OrderAuditLog[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderRequest {
  customerId: string;
  items: Array<{ sku: string; quantity: number }>;
  shippingAddress: Address;
  currency?: string;
}

export interface UpdateOrderStatusRequest {
  orderId: string;
  newStatus: OrderStatus;
  actorId: string;
  note?: string;
  trackingNumber?: string;
}
