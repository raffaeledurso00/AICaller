// packages/backend/src/common/middleware/audit-log.middleware.ts
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuditLogService } from '../services/audit-log.service';
import { AuditActionType } from '../schemas/audit-log.schema';

@Injectable()
export class AuditLogMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuditLogMiddleware.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Only audit certain operations
    const shouldAudit = this.shouldAuditRequest(req);
    
    if (shouldAudit) {
      // Extract user info if available
      const user = (req as any).user;
      const userId = user?._id ? user._id.toString() : null;
      
      // Determine entity and action type
      const { action, entity, entityId } = this.getAuditInfo(req);
      
      // Log the action
      this.auditLogService
        .log(// packages/backend/src/common/middleware/audit-log.middleware.ts (continued)
            action,
            entity,
            userId,
            req,
            { 
              method: req.method,
              path: req.path,
              query: req.query
            },
            'pending',
            entityId
          )
          .catch(error => {
            this.logger.error(`Failed to create audit log: ${error.message}`);
          });
        
        // Capture the response status for the audit log
        const originalEnd = res.end;
        res.end = function(...args) {
          const status = res.statusCode >= 400 ? 'failed' : 'success';
          
          // Update the audit log with the response status
          auditLogService
            .log(
              action,
              entity,
              userId,
              req,
              { 
                status: res.statusCode,
                method: req.method,
                path: req.path
              },
              status,
              entityId
            )
            .catch(error => {
              logger.error(`Failed to update audit log: ${error.message}`);
            });
          
          return originalEnd.apply(res, args);
        };
      }
      
      next();
    }
  
    private shouldAuditRequest(req: Request): boolean {
      // Don't audit health checks, static assets, etc.
      if (req.path.startsWith('/health') || req.path.startsWith('/static')) {
        return false;
      }
      
      // Audit all non-GET requests
      if (req.method !== 'GET') {
        return true;
      }
      
      // Audit sensitive data access (customize this based on your application)
      if (
        req.path.includes('/users') ||
        req.path.includes('/contacts') ||
        req.path.includes('/calls') ||
        req.path.includes('/campaign')
      ) {
        return true;
      }
      
      return false;
    }
  
    private getAuditInfo(req: Request): { action: AuditActionType; entity: string; entityId?: string } {
      // Extract entity from the path
      const pathParts = req.path.split('/').filter(Boolean);
      const entity = pathParts[0] || 'unknown';
      
      // Extract entity ID if present
      const entityId = pathParts.length > 1 ? pathParts[1] : undefined;
      
      // Determine action type based on HTTP method
      let action: AuditActionType;
      switch (req.method) {
        case 'GET':
          action = AuditActionType.READ;
          break;
        case 'POST':
          action = AuditActionType.CREATE;
          break;
        case 'PUT':
        case 'PATCH':
          action = AuditActionType.UPDATE;
          break;
        case 'DELETE':
          action = AuditActionType.DELETE;
          break;
        default:
          action = AuditActionType.OTHER;
      }
      
      // Handle special cases
      if (req.path.includes('/login')) {
        action = AuditActionType.LOGIN;
        return { action, entity: 'auth', entityId: undefined };
      } else if (req.path.includes('/logout')) {
        action = AuditActionType.LOGOUT;
        return { action, entity: 'auth', entityId: undefined };
      } else if (req.path.includes('/export')) {
        action = AuditActionType.EXPORT;
      }
      
      return { action, entity, entityId };
    }
  }