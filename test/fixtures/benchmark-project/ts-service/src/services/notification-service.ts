/**
 * Notification service for dispatching transactional emails and webhooks.
 */

import { Order, OrderStatus } from '../models/order';

export interface EmailPayload {
  to: string;
  subject: string;
  templateId: string;
  variables: Record<string, unknown>;
}

export interface WebhookPayload {
  event: string;
  timestamp: string;
  payload: Record<string, unknown>;
  signature: string;
}

export class NotificationService {
  private webhookSecret: string;
  private emailQueue: EmailPayload[] = [];
  private webhookLogs: WebhookPayload[] = [];

  constructor(webhookSecret: string = 'default-secret-key-1234') {
    this.webhookSecret = webhookSecret;
  }

  /**
   * Dispatch notification when order status changes.
   */
  public async notifyOrderStatusChanged(order: Order, previousStatus: OrderStatus | null): Promise<void> {
    const customerEmail = order.customer.email;
    const subject = `Order ${order.orderNumber} Status Update: ${order.status}`;

    const email: EmailPayload = {
      to: customerEmail,
      subject,
      templateId: `order-status-${order.status}`,
      variables: {
        orderNumber: order.orderNumber,
        customerName: order.customer.displayName,
        status: order.status,
        previousStatus: previousStatus || 'none',
        totalFormatted: `$${(order.pricing.totalCents / 100).toFixed(2)}`,
        itemsCount: order.items.length,
        trackingNumber: order.trackingNumber || null
      }
    };

    await this.sendEmail(email);

    // Also dispatch webhook
    await this.dispatchWebhook('order.status_updated', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      previousStatus
    });
  }

  /**
   * Send transactional email.
   */
  public async sendEmail(payload: EmailPayload): Promise<{ messageId: string; delivered: boolean }> {
    if (!payload.to || !payload.to.includes('@')) {
      throw new Error(`Invalid email destination: ${payload.to}`);
    }

    this.emailQueue.push(payload);
    const mockMessageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return {
      messageId: mockMessageId,
      delivered: true
    };
  }

  /**
   * Sign and emit webhook.
   */
  public async dispatchWebhook(event: string, data: Record<string, unknown>): Promise<boolean> {
    const timestamp = new Date().toISOString();
    const serialized = JSON.stringify({ event, timestamp, data });

    // Mock HMAC signature calculation
    let hash = 0;
    const combined = `${serialized}:${this.webhookSecret}`;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    const signature = `sha256_${Math.abs(hash).toString(16)}`;

    const webhook: WebhookPayload = {
      event,
      timestamp,
      payload: data,
      signature
    };

    this.webhookLogs.push(webhook);
    return true;
  }

  public getPendingEmailsCount(): number {
    return this.emailQueue.length;
  }

  public getDispatchedWebhooks(): WebhookPayload[] {
    return [...this.webhookLogs];
  }
}
