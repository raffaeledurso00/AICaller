import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import * as NodeCache from 'node-cache';

@Injectable()
export class CacheMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CacheMiddleware.name);
  private readonly cache: NodeCache;

  constructor(private readonly configService: ConfigService) {
    // Default TTL is 5 minutes, check period is 1 minute
    const ttl = this.configService.get<number>('cache.ttl', 300);
    const checkperiod = this.configService.get<number>('cache.checkperiod', 60);
    
    this.cache = new NodeCache({
      stdTTL: ttl,
      checkperiod: checkperiod,
      useClones: false,
    });
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Skip cache for non-GET requests or if cache is explicitly disabled for this request
    if (req.method !== 'GET' || req.headers['x-no-cache']) {
      return next();
    }

    // Create a cache key from the request URL and any query parameters
    const cacheKey = `${req.originalUrl || req.url}`;

    // Try to get from cache
    const cachedResponse = this.cache.get(cacheKey);
    if (cachedResponse) {
      this.logger.debug(`Cache hit for: ${cacheKey}`);
      return res.send(cachedResponse);
    }

    // If not in cache, continue request and cache the response
    this.logger.debug(`Cache miss for: ${cacheKey}`);
    
    // Store original send method
    const originalSend = res.send;
    
    // Override send method to cache the response
    res.send = ((body: any): Response => {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Don't cache large responses or error responses
        const shouldCache = typeof body === 'string' || 
                           (typeof body === 'object' && body !== null);
        
        if (shouldCache) {
          // Set in cache with default TTL
          this.cache.set(cacheKey, body);
          this.logger.debug(`Cached response for: ${cacheKey}`);
        }
      }
      
      // Call original send
      return originalSend.call(res, body);
    }).bind(res);
    
    next();
  }

  /**
   * Manually invalidate a cache entry
   */
  invalidateCache(url: string): void {
    this.cache.del(url);
    this.logger.debug(`Invalidated cache for: ${url}`);
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.flushAll();
    this.logger.debug('Cleared all cache');
  }
}