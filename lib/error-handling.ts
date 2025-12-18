// Error handling utilities

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

// Structured logging
export interface LogContext {
  userId?: string;
  requestId?: string;
  [key: string]: any;
}

export function logError(error: Error, context?: LogContext) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: 'error',
    error: {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    },
    context,
  };

  console.error(JSON.stringify(logEntry));

  // TODO: Send to monitoring service (Sentry, LogRocket, etc.)
  // if (process.env.NODE_ENV === 'production') {
  //   Sentry.captureException(error, { extra: context });
  // }
}

export function logInfo(message: string, context?: LogContext) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: 'info',
    message,
    context,
  };

  console.log(JSON.stringify(logEntry));
}

