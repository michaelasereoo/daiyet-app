/**
 * Authentication Type Definitions
 * Centralized type definitions for the authentication system
 */

import { Session, User as SupabaseUser } from '@supabase/supabase-js';

/**
 * User roles in the system
 */
export type UserRole = 'USER' | 'DIETITIAN' | 'ADMIN';

/**
 * Account status values
 */
export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION' | 'PENDING_ENROLLMENT';

/**
 * OAuth providers
 */
export type AuthProvider = 'google' | 'github' | 'microsoft' | 'email';

/**
 * Extended user object with database fields
 */
export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: UserRole;
  account_status: AccountStatus;
  email_verified: string | null; // ISO timestamp
  last_sign_in_at: string | null; // ISO timestamp
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  metadata: Record<string, any> | null;
}

/**
 * Authentication result
 */
export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  error?: AuthErrorCode;
  session?: Session;
}

/**
 * Role check result
 */
export interface RoleResult {
  authorized: boolean;
  userRole?: UserRole;
  error?: string;
}

/**
 * Permission check result
 */
export interface PermissionResult {
  authorized: boolean;
  permission?: string;
  error?: string;
}

/**
 * Authentication error codes
 */
export enum AuthErrorCode {
  // Session errors
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  NO_SESSION = 'NO_SESSION',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_REFRESH_FAILED = 'TOKEN_REFRESH_FAILED',
  
  // Authorization errors
  ROLE_MISMATCH = 'ROLE_MISMATCH',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',
  ACCOUNT_PENDING = 'ACCOUNT_PENDING',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Security errors
  CSRF_TOKEN_INVALID = 'CSRF_TOKEN_INVALID',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  BRUTE_FORCE_DETECTED = 'BRUTE_FORCE_DETECTED',
  
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  
  // Server errors
  SERVER_ERROR = 'SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
}

/**
 * Permission types for RBAC
 */
export type Permission =
  // Booking permissions
  | 'book:create'
  | 'book:view:own'
  | 'book:view:all'
  | 'book:cancel:own'
  | 'book:cancel:any'
  
  // Event permissions
  | 'event:create'
  | 'event:view:own'
  | 'event:view:all'
  | 'event:edit:own'
  | 'event:edit:any'
  | 'event:delete:own'
  | 'event:delete:any'
  
  // Admin permissions
  | 'admin:users:view'
  | 'admin:users:edit'
  | 'admin:users:delete'
  | 'admin:analytics:view'
  | 'admin:settings:manage'
  | 'admin:audit:view'
  
  // Profile permissions
  | 'profile:view:own'
  | 'profile:edit:own'
  | 'profile:view:any';

/**
 * Security event severity levels
 */
export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Security event types
 */
export type SecurityEventType =
  | 'signin_attempt'
  | 'signin_success'
  | 'signin_failed'
  | 'signout'
  | 'session_created'
  | 'session_refreshed'
  | 'session_expired'
  | 'session_invalidated'
  | 'session_revoked'
  | 'role_changed'
  | 'account_suspended'
  | 'account_activated'
  | 'password_changed'
  | 'email_verified'
  | 'suspicious_login'
  | 'brute_force_detected'
  | 'account_takeover_attempt'
  | 'rate_limit_exceeded'
  | 'unauthorized_access'
  | 'permission_denied';

/**
 * OAuth state parameter structure
 */
export interface OAuthState {
  redirectTo: string;
  timestamp: number;
  nonce: string;
  origin?: string;
  userAgent?: string;
}

/**
 * Device session information
 */
export interface DeviceSession {
  id: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  ipAddress: string;
  userAgent: string;
  lastActiveAt: Date;
  createdAt: Date;
}

/**
 * Session metadata for tracking
 */
export interface SessionMetadata {
  deviceId: string;
  deviceName: string;
  ipAddress: string;
  userAgent: string;
  firstSeen: Date;
  lastSeen: Date;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs: number;
  max: number;
  blockDuration?: number;
  alertThreshold?: number;
}

/**
 * Route protection configuration
 */
export interface ProtectedRoute {
  path: string;
  methods: string[];
  permission?: Permission;
  roles?: UserRole[];
  requireAuth: boolean;
}

/**
 * Auth configuration type
 */
export interface AuthConfig {
  development: {
    cookieOptions: {
      secure: boolean;
      sameSite: 'lax' | 'strict' | 'none';
      path: string;
      domain?: string;
      httpOnly?: boolean;
    };
    sessionRefreshInterval: number;
  };
  production: {
    cookieOptions: {
      secure: boolean;
      sameSite: 'lax' | 'strict' | 'none';
      path: string;
      domain?: string;
      httpOnly: boolean;
    };
    sessionRefreshInterval: number;
  };
  providers: Record<AuthProvider, {
    scopes: string[];
    additionalParams: Record<string, string>;
  }>;
  redirects: Record<UserRole, string> & { default: string };
  session: {
    maxAge: number;
    updateAge: number;
  };
}

/**
 * Auth callback result
 */
export interface AuthCallbackResult {
  success: boolean;
  user?: AppUser;
  session?: Session;
  redirectTo?: string;
  error?: AuthErrorCode;
  errorMessage?: string;
}

/**
 * Middleware auth check result
 */
export interface MiddlewareAuthResult {
  authenticated: boolean;
  user?: AppUser;
  session?: Session;
  redirectTo?: string;
  error?: AuthErrorCode;
}

/**
 * Type guard for UserRole
 */
export function isUserRole(value: string): value is UserRole {
  return ['USER', 'DIETITIAN', 'ADMIN'].includes(value);
}

/**
 * Type guard for AccountStatus
 */
export function isAccountStatus(value: string): value is AccountStatus {
  return ['ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION', 'PENDING_ENROLLMENT'].includes(value);
}

/**
 * Helper to get role hierarchy level
 */
export function getRoleLevel(role: UserRole): number {
  const hierarchy: Record<UserRole, number> = {
    USER: 1,
    DIETITIAN: 2,
    ADMIN: 3,
  };
  return hierarchy[role] || 0;
}

/**
 * Helper to check if role has sufficient level
 */
export function hasRoleLevel(userRole: UserRole, requiredRole: UserRole): boolean {
  return getRoleLevel(userRole) >= getRoleLevel(requiredRole);
}
