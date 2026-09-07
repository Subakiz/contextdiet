/**
 * In-memory transaction-safe repository for orders.
 */

import { Order, OrderStatus, OrderItem, OrderPricing } from '../models/order';

export interface OrderQueryOptions {
  customerId?: string;
  status?: OrderStatus;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'totalCents';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export class OrderRepository {
  private storage: Map<string, Order> = new Map();
  private orderNumberIndex: Map<string, string> = new Map();
  private customerIndex: Map<string, Set<string>> = new Map();

  /**
   * Save a newly created order.
   */
  public async save(order: Order): Promise<Order> {
    if (this.storage.has(order.id)) {
      throw new Error(`Order with ID ${order.id} already exists in database.`);
    }

    // Clone order to prevent outside reference mutation
    const cloned: Order = JSON.parse(JSON.stringify(order));
    cloned.createdAt = new Date(order.createdAt);
    cloned.updatedAt = new Date(order.updatedAt);

    this.storage.set(order.id, cloned);
    this.orderNumberIndex.set(order.orderNumber, order.id);

    // Index by customer
    const customerId = order.customer.id;
    let customerOrders = this.customerIndex.get(customerId);
    if (!customerOrders) {
      customerOrders = new Set();
      this.customerIndex.set(customerId, customerOrders);
    }
    customerOrders.add(order.id);

    return cloned;
  }

  /**
   * Find order by unique primary identifier.
   */
  public async findById(orderId: string): Promise<Order | null> {
    const order = this.storage.get(orderId);
    if (!order) {
      return null;
    }
    return JSON.parse(JSON.stringify(order));
  }

  /**
   * Find order by human-readable order number.
   */
  public async findByOrderNumber(orderNumber: string): Promise<Order | null> {
    const id = this.orderNumberIndex.get(orderNumber);
    if (!id) {
      return null;
    }
    return this.findById(id);
  }

  /**
   * Update existing order.
   */
  public async update(orderId: string, mutator: (existing: Order) => void): Promise<Order> {
    const existing = this.storage.get(orderId);
    if (!existing) {
      throw new Error(`Cannot update non-existent order: ${orderId}`);
    }

    const cloned: Order = JSON.parse(JSON.stringify(existing));
    mutator(cloned);
    cloned.updatedAt = new Date();

    this.storage.set(orderId, cloned);
    return JSON.parse(JSON.stringify(cloned));
  }

  /**
   * Query orders with multi-parameter filtering, sorting, and pagination.
   */
  public async query(options: OrderQueryOptions = {}): Promise<PaginatedResult<Order>> {
    let matches: Order[] = Array.from(this.storage.values());

    if (options.customerId) {
      const ids = this.customerIndex.get(options.customerId);
      if (!ids) {
        return { items: [], total: 0, limit: options.limit ?? 20, offset: options.offset ?? 0, hasMore: false };
      }
      matches = matches.filter((o) => ids.has(o.id));
    }

    if (options.status) {
      matches = matches.filter((o) => o.status === options.status);
    }

    if (options.startDate) {
      const startMs = options.startDate.getTime();
      matches = matches.filter((o) => new Date(o.createdAt).getTime() >= startMs);
    }

    if (options.endDate) {
      const endMs = options.endDate.getTime();
      matches = matches.filter((o) => new Date(o.createdAt).getTime() <= endMs);
    }

    const sortBy = options.sortBy ?? 'createdAt';
    const sortOrder = options.sortOrder ?? 'desc';

    matches.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'createdAt') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === 'totalCents') {
        comparison = a.pricing.totalCents - b.pricing.totalCents;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    const total = matches.length;
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 20;
    const paged = matches.slice(offset, offset + limit);

    return {
      items: paged.map((o) => JSON.parse(JSON.stringify(o))),
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    };
  }

  /**
   * Compute comprehensive sales aggregations and order statistics.
   */
  public async computeAggregates(startDate: Date, endDate: Date): Promise<{
    totalRevenueCents: number;
    averageOrderValueCents: number;
    orderCountByStatus: Record<OrderStatus, number>;
    topCustomerIds: Array<{ customerId: string; totalSpentCents: number }>;
  }> {
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();
    let totalRevenue = 0;
    let qualifyingCount = 0;
    const statusCounts: Record<string, number> = {};
    const customerSpending: Map<string, number> = new Map();

    for (const order of this.storage.values()) {
      const orderMs = new Date(order.createdAt).getTime();
      if (orderMs >= startMs && orderMs <= endMs) {
        qualifyingCount++;
        totalRevenue += order.pricing.totalCents;

        // Group by status
        statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;

        // Group by customer
        const custId = order.customer.id;
        const currentSpent = customerSpending.get(custId) || 0;
        customerSpending.set(custId, currentSpent + order.pricing.totalCents);
      }
    }

    const sortedCustomers = Array.from(customerSpending.entries())
      .map(([customerId, totalSpentCents]) => ({ customerId, totalSpentCents }))
      .sort((a, b) => b.totalSpentCents - a.totalSpentCents)
      .slice(0, 10);

    const avg = qualifyingCount > 0 ? Math.round(totalRevenue / qualifyingCount) : 0;

    return {
      totalRevenueCents: totalRevenue,
      averageOrderValueCents: avg,
      orderCountByStatus: statusCounts as Record<OrderStatus, number>,
      topCustomerIds: sortedCustomers
    };
  }

  /**
   * Delete order by ID.
   */
  public async delete(orderId: string): Promise<boolean> {
    const existing = this.storage.get(orderId);
    if (!existing) {
      return false;
    }

    this.orderNumberIndex.delete(existing.orderNumber);
    const customerOrders = this.customerIndex.get(existing.customer.id);
    if (customerOrders) {
      customerOrders.delete(orderId);
    }

    return this.storage.delete(orderId);
  }
}
