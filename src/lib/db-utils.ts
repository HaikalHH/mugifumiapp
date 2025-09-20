import { prisma } from './prisma';

/**
 * Retry wrapper for database operations to handle intermittent connection issues
 */
export async function withRetry<T>(
  fn: () => Promise<T>, 
  retries = 2,
  routeName = 'unknown'
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    console.error(`Database error in ${routeName}:`, error);
    
    if (retries > 0 && error.message?.includes('Prisma')) {
      console.log(`Retrying database query in ${routeName}... ${retries} attempts left`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return withRetry(fn, retries - 1, routeName);
    }
    throw error;
  }
}

/**
 * Standard error response for API routes
 */
export function createErrorResponse(
  action: string, 
  error: any, 
  status = 500
) {
  console.error(`API Error in ${action}:`, error);
  
  return {
    error: `Failed to ${action}`,
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  };
}

/**
 * Log route execution for debugging
 */
export function logRouteStart(routeName: string, params?: any) {
  console.log(`Starting ${routeName} request...`, params ? { params } : '');
}

/**
 * Log route completion
 */
export function logRouteComplete(routeName: string, resultCount?: number) {
  console.log(`Completed ${routeName} request${resultCount ? ` - found ${resultCount} items` : ''}`);
}
