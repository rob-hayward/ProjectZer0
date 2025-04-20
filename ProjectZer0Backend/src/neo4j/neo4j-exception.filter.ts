import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Custom exception filter specifically for Neo4j database errors
 * This helps provide more meaningful error responses for Neo4j-related issues
 */
@Catch(Error)
export class Neo4jExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(Neo4jExceptionFilter.name);

  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Default status and message
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details = null;

    // Handle Neo4j specific errors
    if (exception.name === 'Neo4jError') {
      this.logger.error(`Neo4j error: ${exception.message}`, exception.stack);

      // Extract Neo4j error code if available
      const neoErrorMatch = exception.message.match(/^Neo\.(.+)\.(.+)$/);
      if (neoErrorMatch) {
        details = {
          neo4jCode: neoErrorMatch[0],
          category: neoErrorMatch[1],
          title: neoErrorMatch[2],
        };
      }

      // Constraint violation errors
      if (exception.message.includes('already exists with label')) {
        status = HttpStatus.CONFLICT;
        message = 'Constraint violation: Duplicate record';
      }
      // Connection errors
      else if (
        exception.message.includes('connection refused') ||
        exception.message.includes('connection terminated')
      ) {
        message = 'Database connection issue';
      }
      // Syntax errors
      else if (exception.message.includes('Invalid syntax')) {
        message = 'Database query syntax error';
        details = { query: 'Error in database query' };
      }
      // Property access errors (often related to null/undefined property access)
      else if (
        exception.message.includes('undefined property') ||
        exception.message.includes('null property')
      ) {
        message = 'Database property access error';
      }
    } else {
      // Log other types of errors
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
      );
    }

    // Create a standardized error response
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      details,
      // Include original error message in non-production environments
      ...(process.env.NODE_ENV !== 'production' && {
        error: exception.message,
        stack: exception.stack?.split('\n'),
      }),
    });
  }
}
