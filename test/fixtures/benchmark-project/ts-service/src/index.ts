/**
 * ContextDiet Benchmark: TypeScript Microservice Entry Point.
 * Orchestrates routes, controllers, services, repositories, and models.
 */

import { OrderRepository } from './repositories/order-repository';
import { NotificationService } from './services/notification-service';
import { OrderService } from './services/order-service';
import { OrderController, HttpRequest, HttpResponse } from './controllers/order-controller';
import { OrderRouter, HttpMethod } from './routes/order-routes';
import { CreateOrderRequest, Order, OrderStatus } from './models/order';
import { User } from './models/user';

export interface AppConfig {
  port: number;
  environment: 'development' | 'production' | 'test';
  webhookSecret: string;
}

export class OrderApplication {
  private config: AppConfig;
  private repository: OrderRepository;
  private notificationService: NotificationService;
  private orderService: OrderService;
  private controller: OrderController;
  private router: OrderRouter;
  private isRunning: boolean = false;

  constructor(config: Partial<AppConfig> = {}) {
    this.config = {
      port: config.port ?? 3000,
      environment: config.environment ?? 'development',
      webhookSecret: config.webhookSecret ?? 'secret-key-12345'
    };

    this.repository = new OrderRepository();
    this.notificationService = new NotificationService(this.config.webhookSecret);
    this.orderService = new OrderService(this.repository, this.notificationService);
    this.controller = new OrderController(this.orderService);
    this.router = new OrderRouter(this.controller);
  }

  /**
   * Boot application server.
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Application is already running.');
    }
    this.isRunning = true;
    // Log server boot
  }

  /**
   * Shutdown application.
   */
  public async stop(): Promise<void> {
    this.isRunning = false;
  }

  /**
   * Direct invocation of router for HTTP requests.
   */
  public async handleRequest(
    method: HttpMethod,
    path: string,
    req: Omit<HttpRequest, 'params'>
  ): Promise<HttpResponse> {
    return this.router.dispatch(method, path, req);
  }

  public getOrderService(): OrderService {
    return this.orderService;
  }

  public getNotificationService(): NotificationService {
    return this.notificationService;
  }
}

export default OrderApplication;
