/**
 * High-level business logic for managing orders and checkout lifecycle.
 */

import {
  Order,
  OrderStatus,
  OrderItem,
  OrderPricing,
  CreateOrderRequest,
  UpdateOrderStatusRequest
} from '../models/order';
import { User, Address } from '../models/user';
import { OrderRepository, PaginatedResult, OrderQueryOptions } from '../repositories/order-repository';
import { NotificationService } from './notification-service';

export interface TaxCalculationResult {
  taxCents: number;
  rateApplied: number;
  breakdown: Record<string, number>;
}

export interface InventoryCheckResult {
  available: boolean;
  unavailableSkus: string[];
}

export class OrderService {
  private repository: OrderRepository;
  private notificationService: NotificationService;

  constructor(repository: OrderRepository, notificationService: NotificationService) {
    this.repository = repository;
    this.notificationService = notificationService;
  }

  /**
   * Create and persist a new order.
   */
  public async createOrder(
    request: CreateOrderRequest,
    customer: Pick<User, 'id' | 'email' | 'displayName'>
  ): Promise<Order> {
    if (!request.items || request.items.length === 0) {
      throw new Error('An order must contain at least one item.');
    }

    // Step 1: Validate inventory
    const inventory = await this.checkInventory(request.items);
    if (!inventory.available) {
      throw new Error(`Out of stock items: ${inventory.unavailableSkus.join(', ')}`);
    }

    // Step 2: Hydrate full items with pricing
    const hydratedItems: OrderItem[] = request.items.map((item, index) => {
      const unitPriceCents = this.lookupPriceForSku(item.sku);
      return {
        id: `item_${Date.now()}_${index}`,
        sku: item.sku,
        title: `Product ${item.sku.toUpperCase()}`,
        unitPriceCents,
        quantity: item.quantity,
        taxCode: 'standard_tax',
        discountCents: item.quantity > 5 ? 100 : 0
      };
    });

    // Step 3: Compute pricing and taxes
    const pricing = this.calculatePricing(hydratedItems, request.shippingAddress, request.currency || 'USD');

    // Step 4: Assemble order entity
    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
    const newOrder: Order = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orderNumber,
      customer,
      items: hydratedItems,
      pricing,
      shippingAddress: request.shippingAddress,
      status: 'pending',
      auditTrail: [
        {
          timestamp: new Date(),
          previousStatus: null,
          newStatus: 'pending',
          actorId: customer.id,
          note: 'Initial order placement'
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const saved = await this.repository.save(newOrder);
    await this.notificationService.notifyOrderStatusChanged(saved, null);
    return saved;
  }

  /**
   * Transition order to a new status with validation.
   */
  public async transitionStatus(request: UpdateOrderStatusRequest): Promise<Order> {
    const existing = await this.repository.findById(request.orderId);
    if (!existing) {
      throw new Error(`Order not found: ${request.orderId}`);
    }

    this.validateStatusTransition(existing.status, request.newStatus);
    const prevStatus = existing.status;

    const updated = await this.repository.update(request.orderId, (order) => {
      order.status = request.newStatus;
      if (request.trackingNumber) {
        order.trackingNumber = request.trackingNumber;
      }
      order.auditTrail.push({
        timestamp: new Date(),
        previousStatus: prevStatus,
        newStatus: request.newStatus,
        actorId: request.actorId,
        note: request.note
      });
    });

    await this.notificationService.notifyOrderStatusChanged(updated, prevStatus);
    return updated;
  }

  /**
   * Retrieve order by ID.
   */
  public async getOrderById(orderId: string): Promise<Order | null> {
    return this.repository.findById(orderId);
  }

  /**
   * Search and filter orders.
   */
  public async listOrders(options: OrderQueryOptions): Promise<PaginatedResult<Order>> {
    return this.repository.query(options);
  }

  /**
   * Calculate complete pricing including subtotal, discounts, shipping, and taxes.
   */
  public calculatePricing(items: OrderItem[], address: Address, currency: string = 'USD'): OrderPricing {
    let subtotalCents = 0;
    let totalDiscountCents = 0;

    for (const item of items) {
      const itemTotal = item.unitPriceCents * item.quantity;
      const discount = (item.discountCents || 0) * item.quantity;
      subtotalCents += itemTotal;
      totalDiscountCents += discount;
    }

    const shippingCents = subtotalCents > 10000 ? 0 : 995; // Free shipping over $100
    const taxCalc = this.calculateTaxes(subtotalCents - totalDiscountCents, address);
    const totalCents = Math.max(0, subtotalCents - totalDiscountCents + shippingCents + taxCalc.taxCents);

    return {
      subtotalCents,
      shippingCents,
      taxCents: taxCalc.taxCents,
      totalDiscountCents,
      totalCents,
      currency
    };
  }

  /**
   * Internal tax rate determination.
   */
  private calculateTaxes(taxableAmountCents: number, address: Address): TaxCalculationResult {
    let rate = 0.05; // Base 5%
    if (address.country === 'US') {
      if (address.state === 'CA') rate = 0.0925;
      else if (address.state === 'NY') rate = 0.08875;
      else if (address.state === 'TX') rate = 0.0825;
    } else if (address.country === 'GB') {
      rate = 0.20; // 20% VAT
    }

    const taxCents = Math.round(taxableAmountCents * rate);
    return {
      taxCents,
      rateApplied: rate,
      breakdown: {
        stateTax: Math.round(taxCents * 0.7),
        localTax: Math.round(taxCents * 0.3)
      }
    };
  }

  private lookupPriceForSku(sku: string): number {
    // Mock sku pricing database
    const prices: Record<string, number> = {
      'SKU-PRO-001': 4999,
      'SKU-PRO-002': 8999,
      'SKU-ACC-010': 1499,
      'SKU-SUB-MONTH': 1999
    };
    return prices[sku] || 2500;
  }

  private async checkInventory(items: Array<{ sku: string; quantity: number }>): Promise<InventoryCheckResult> {
    const unavailable: string[] = [];
    for (const item of items) {
      if (item.quantity > 50) {
        unavailable.push(item.sku);
      }
    }
    return {
      available: unavailable.length === 0,
      unavailableSkus: unavailable
    };
  }

  /**
   * Process refund request for an eligible order.
   */
  public async processRefund(orderId: string, amountCents?: number, reason: string = 'customer_request'): Promise<Order> {
    const existing = await this.repository.findById(orderId);
    if (!existing) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (existing.status !== 'delivered' && existing.status !== 'paid') {
      throw new Error(`Order ${orderId} in status '${existing.status}' cannot be refunded.`);
    }

    const refundAmount = amountCents !== undefined ? amountCents : existing.pricing.totalCents;
    if (refundAmount <= 0 || refundAmount > existing.pricing.totalCents) {
      throw new Error(`Refund amount of ${refundAmount} cents is invalid for order total ${existing.pricing.totalCents}`);
    }

    const updated = await this.transitionStatus({
      orderId,
      newStatus: 'refunded',
      actorId: 'billing_service',
      note: `Refund processed: $${(refundAmount / 100).toFixed(2)}. Reason: ${reason}`
    });

    return updated;
  }

  /**
   * Generate itemized invoice text receipt.
   */
  public generateInvoiceText(order: Order): string {
    const lines: string[] = [
      '==================================================',
      `INVOICE: ${order.orderNumber}`,
      `DATE:    ${new Date(order.createdAt).toISOString()}`,
      `STATUS:  ${order.status.toUpperCase()}`,
      '--------------------------------------------------',
      'ITEMS:'
    ];

    for (const item of order.items) {
      const lineTotal = ((item.unitPriceCents * item.quantity) / 100).toFixed(2);
      lines.push(`  - ${item.sku.padEnd(16)} x${item.quantity.toString().padEnd(3)} $${lineTotal}`);
    }

    lines.push('--------------------------------------------------');
    lines.push(`SUBTOTAL:  $${(order.pricing.subtotalCents / 100).toFixed(2)}`);
    lines.push(`DISCOUNT: -$${(order.pricing.totalDiscountCents / 100).toFixed(2)}`);
    lines.push(`SHIPPING:  $${(order.pricing.shippingCents / 100).toFixed(2)}`);
    lines.push(`TAX:       $${(order.pricing.taxCents / 100).toFixed(2)}`);
    lines.push(`TOTAL:     $${(order.pricing.totalCents / 100).toFixed(2)} ${order.pricing.currency}`);
    lines.push('==================================================');

    return lines.join('\n');
  }

  private validateStatusTransition(current: OrderStatus, target: OrderStatus): void {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      pending: ['payment_processing', 'cancelled'],
      payment_processing: ['paid', 'cancelled'],
      paid: ['fulfillment_in_progress', 'refunded'],
      fulfillment_in_progress: ['shipped', 'cancelled'],
      shipped: ['delivered', 'refunded'],
      delivered: ['refunded'],
      cancelled: [],
      refunded: []
    };

    const allowed = validTransitions[current] || [];
    if (!allowed.includes(target)) {
      throw new Error(`Illegal order transition from status '${current}' to '${target}'.`);
    }
  }
}
