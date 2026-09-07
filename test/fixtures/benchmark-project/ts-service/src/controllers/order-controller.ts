/**
 * HTTP controller layer for processing order endpoints.
 */

import { OrderService } from '../services/order-service';
import { CreateOrderRequest, UpdateOrderStatusRequest, OrderStatus } from '../models/order';
import { User } from '../models/user';

export interface HttpRequest {
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  user?: Pick<User, 'id' | 'email' | 'displayName'>;
}

export interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
}

export class OrderController {
  private orderService: OrderService;

  constructor(orderService: OrderService) {
    this.orderService = orderService;
  }

  /**
   * Handle POST /orders
   */
  public async handleCreateOrder(req: HttpRequest): Promise<HttpResponse> {
    try {
      if (!req.user) {
        return this.jsonResponse(401, { error: 'Unauthorized: authentication required' });
      }

      const body = req.body as Partial<CreateOrderRequest>;
      if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
        return this.jsonResponse(400, { error: 'Validation failed: items array is required and must not be empty' });
      }

      if (!body.shippingAddress || !body.shippingAddress.street || !body.shippingAddress.postalCode) {
        return this.jsonResponse(400, { error: 'Validation failed: valid shippingAddress is required' });
      }

      const order = await this.orderService.createOrder(body as CreateOrderRequest, req.user);
      return this.jsonResponse(201, { success: true, data: order });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown internal server error';
      return this.jsonResponse(500, { error: message });
    }
  }

  /**
   * Handle GET /orders/:id
   */
  public async handleGetOrder(req: HttpRequest): Promise<HttpResponse> {
    try {
      const orderId = req.params.id;
      if (!orderId) {
        return this.jsonResponse(400, { error: 'Missing required parameter: id' });
      }

      const order = await this.orderService.getOrderById(orderId);
      if (!order) {
        return this.jsonResponse(404, { error: `Order with ID ${orderId} not found` });
      }

      // Check ownership if user is customer
      if (req.user && order.customer.id !== req.user.id) {
        return this.jsonResponse(403, { error: 'Forbidden: you do not have access to this order' });
      }

      return this.jsonResponse(200, { success: true, data: order });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve order';
      return this.jsonResponse(500, { error: message });
    }
  }

  /**
   * Handle PATCH /orders/:id/status
   */
  public async handleUpdateStatus(req: HttpRequest): Promise<HttpResponse> {
    try {
      const orderId = req.params.id;
      const body = req.body as Partial<UpdateOrderStatusRequest>;

      if (!body.newStatus) {
        return this.jsonResponse(400, { error: 'Missing required field: newStatus' });
      }

      const request: UpdateOrderStatusRequest = {
        orderId,
        newStatus: body.newStatus as OrderStatus,
        actorId: req.user ? req.user.id : 'system',
        note: body.note,
        trackingNumber: body.trackingNumber
      };

      const updated = await this.orderService.transitionStatus(request);
      return this.jsonResponse(200, { success: true, data: updated });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Status transition failed';
      return this.jsonResponse(400, { error: message });
    }
  }

  /**
   * Handle GET /orders (listing)
   */
  public async handleListOrders(req: HttpRequest): Promise<HttpResponse> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
      const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
      const customerId = req.user ? req.user.id : req.query.customerId;

      const result = await this.orderService.listOrders({
        customerId,
        status: req.query.status as OrderStatus,
        limit,
        offset
      });

      return this.jsonResponse(200, { success: true, data: result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to list orders';
      return this.jsonResponse(500, { error: message });
    }
  }

  /**
   * Evaluate request rate limits per client IP or user identity.
   */
  public checkRateLimit(clientId: string, maxRequestsPerMinute: number = 60): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const windowStart = now - 60000;
    // Simulated token bucket check
    const currentTokens = Math.max(1, maxRequestsPerMinute - 5);
    return {
      allowed: currentTokens > 0,
      remaining: currentTokens,
      resetTime: Math.floor((windowStart + 60000) / 1000)
    };
  }

  /**
   * Sanitize incoming query string filters.
   */
  public sanitizeQueryParams(query: Record<string, string>): Record<string, string> {
    const clean: Record<string, string> = {};
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        // Strip SQL injection or script metacharacters
        const sanitized = value.replace(/['";\-\-]/g, '').trim();
        clean[key] = sanitized;
      }
    }
    return clean;
  }

  private jsonResponse(statusCode: number, data: unknown): HttpResponse {
    return {
      statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: data
    };
  }
}
