/**
 * Routing table and route dispatcher for orders endpoint.
 */

import { OrderController, HttpRequest, HttpResponse } from '../controllers/order-controller';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RouteHandler {
  method: HttpMethod;
  pattern: RegExp;
  paramNames: string[];
  handler: (req: HttpRequest) => Promise<HttpResponse>;
}

export class OrderRouter {
  private controller: OrderController;
  private routes: RouteHandler[] = [];

  constructor(controller: OrderController) {
    this.controller = controller;
    this.registerRoutes();
  }

  private registerRoutes(): void {
    // POST /orders
    this.addRoute('POST', '/orders', (req) => this.controller.handleCreateOrder(req));

    // GET /orders
    this.addRoute('GET', '/orders', (req) => this.controller.handleListOrders(req));

    // GET /orders/:id
    this.addRoute('GET', '/orders/:id', (req) => this.controller.handleGetOrder(req));

    // PATCH /orders/:id/status
    this.addRoute('PATCH', '/orders/:id/status', (req) => this.controller.handleUpdateStatus(req));
  }

  public addRoute(
    method: HttpMethod,
    path: string,
    handler: (req: HttpRequest) => Promise<HttpResponse>
  ): void {
    const paramNames: string[] = [];
    const regexPattern = path.replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^\\/]+)';
    });

    this.routes.push({
      method,
      pattern: new RegExp(`^${regexPattern}$`),
      paramNames,
      handler
    });
  }

  /**
   * Dispatch incoming URL path and method to matched handler.
   */
  public async dispatch(method: HttpMethod, urlPath: string, req: Omit<HttpRequest, 'params'>): Promise<HttpResponse> {
    for (const route of this.routes) {
      if (route.method !== method) continue;

      const match = urlPath.match(route.pattern);
      if (match) {
        const params: Record<string, string> = {};
        route.paramNames.forEach((name, index) => {
          params[name] = match[index + 1];
        });

        const fullReq: HttpRequest = {
          ...req,
          params
        };

        return route.handler(fullReq);
      }
    }

    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: { error: `Route not found: ${method} ${urlPath}` }
    };
  }
}
