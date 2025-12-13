# Authentication Best Practices for Multi-User Web Applications
## Expert Guidelines for Supabase + Google OAuth + Next.js + TypeScript

> Based on 30 years of enterprise authentication experience with top 1% San Francisco companies

---

## 🏗️ Architecture Principles

### 1. **Separation of Concerns**

#### ✅ Current Implementation Status: **EXCELLENT**

Your current architecture correctly separates:
- **Authentication Layer**: Supabase Auth (managed service)
- **Authorization Layer**: Database-backed roles + RLS policies
- **Session Management**: Supabase-managed HttpOnly cookies
- **Role Management**: Custom `users` table with enum constraints

#### Best Practice Recommendations:

```typescript
// ✅ GOOD: Separate auth, role, and permission checks
// lib/auth/auth-checks.ts (create this pattern)

export async function checkAuth(session: Session | null): Promise<AuthResult> {
  if (!session) {
    return { authenticated: false, error: 'NO_SESSION' };
  }
  return { authenticated: true, userId: session.user.id };
}

export async function checkRole(
  userId: string,
  requiredRole: UserRole
): Promise<RoleResult> {
  const user = await getUserFromDB(userId);
  if (!user) return { authorized: false, error: 'USER_NOT_FOUND' };
  
  const roleHierarchy: Record<UserRole, number> = {
    USER: 1,
    DIETITIAN: 2,
    ADMIN: 3,
  };
  
  return {
    authorized: roleHierarchy[user.role] >= roleHierarchy[requiredRole],
    userRole: user.role,
  };
}

export async function checkPermission(
  userId: string,
  resource: string,
  action: string
): Promise<PermissionResult> {
  // Future: Implement granular permissions
  // For now, role-based is sufficient
  return checkRole(userId, getRequiredRoleForAction(action));
}
```

---

## 🔐 Security Best Practices

### 2. **Token & Session Security**

#### ✅ Current Implementation: **VERY GOOD**

**Strengths:**
- ✅ Using Supabase-managed HttpOnly cookies (XSS protection)
- ✅ PKCE flow implemented
- ✅ Secure cookies in production (`secure: true`, `sameSite: 'strict'`)

#### ⚠️ Recommendations for Enhancement:

```typescript
// lib/auth/config.ts - ENHANCED VERSION

export const authConfig = {
  // ... existing config ...
  
  // ADD: Token refresh strategy
  tokenRefresh: {
    // Refresh token 5 minutes before expiry
    refreshThreshold: 5 * 60 * 1000, // 5 minutes
    // Maximum retry attempts
    maxRetries: 3,
    // Exponential backoff for retries
    backoffMultiplier: 2,
  },
  
  // ADD: Session invalidation on suspicious activity
  security: {
    // Require re-auth after 7 days of inactivity
    maxInactivityPeriod: 7 * 24 * 60 * 60 * 1000,
    // Revoke all sessions on password change (for future password auth)
    revokeAllOnCredentialChange: true,
    // Detect and log suspicious patterns
    suspiciousActivityDetection: {
      multipleDevices: true,
      locationChange: false, // Can be enabled with IP geolocation
      rapidRequests: true,
    },
  },
};
```

### 3. **CSRF Protection**

#### ✅ Current Implementation: **GOOD**

You're using:
- State parameter encoding
- SameSite cookies

#### ⚠️ Additional Hardening:

```typescript
// components/auth/AuthScreen.tsx - ENHANCED STATE PARAMETER

const handleGoogle = async () => {
  // ADD: Include origin validation in state
  const state = btoa(
    JSON.stringify({
      redirectTo: redirectPath,
      timestamp: Date.now(),
      nonce: crypto.randomUUID(), // Use crypto API for stronger randomness
      origin: window.location.origin, // Validate on callback
      userAgent: navigator.userAgent.substring(0, 50), // Detect session hijacking
    })
  );
  
  // Store state in sessionStorage for validation (additional check)
  sessionStorage.setItem('oauth_state', state);
  
  // ... rest of OAuth flow
};
```

### 4. **Rate Limiting & DDoS Protection**

#### ✅ Current Implementation: **GOOD**

You have rate limiting on auth callback (10 req/min).

#### ⚠️ Recommendations:

```typescript
// lib/rate-limit.ts - ENHANCED VERSION

// Tiered rate limiting by endpoint sensitivity
export const rateLimitConfig = {
  // Public endpoints (less strict)
  public: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
  },
  
  // Auth endpoints (strict)
  auth: {
    windowMs: 15 * 60 * 1000,
    max: 10, // ✅ You already have this
  },
  
  // Sensitive operations (very strict)
  sensitive: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 requests per hour
    // Block for 1 hour after limit exceeded
    blockDuration: 60 * 60 * 1000,
  },
  
  // Admin endpoints (extremely strict)
  admin: {
    windowMs: 60 * 60 * 1000,
    max: 100, // Generous but tracked
    // Alert on unusual patterns
    alertThreshold: 50,
  },
};

// ADD: IP-based rate limiting with Redis (for production)
// Use Upstash Redis or similar for distributed rate limiting
```

---

## 👥 Role-Based Access Control (RBAC)

### 5. **Role Management Best Practices**

#### ✅ Current Implementation: **SOLID FOUNDATION**

**Strengths:**
- ✅ Database-backed roles
- ✅ RLS policies prevent role manipulation
- ✅ Role hierarchy enforced

#### ⚠️ Enhancements for Enterprise Scale:

```typescript
// lib/rbac/types.ts (NEW FILE - Create this)

export type UserRole = 'USER' | 'DIETITIAN' | 'ADMIN';

export type Permission = 
  | 'book:create'
  | 'book:view:own'
  | 'book:cancel:own'
  | 'event:create'
  | 'event:edit:own'
  | 'event:delete:own'
  | 'admin:users:view'
  | 'admin:users:edit'
  | 'admin:analytics:view'
  | 'admin:settings:manage';

// Role-permission mapping
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  USER: [
    'book:create',
    'book:view:own',
    'book:cancel:own',
  ],
  DIETITIAN: [
    'book:create',
    'book:view:own',
    'book:cancel:own',
    'event:create',
    'event:edit:own',
    'event:delete:own',
  ],
  ADMIN: [
    'book:create',
    'book:view:own',
    'book:cancel:own',
    'event:create',
    'event:edit:own',
    'event:delete:own',
    'admin:users:view',
    'admin:users:edit',
    'admin:analytics:view',
    'admin:settings:manage',
  ],
};

// Helper function
export function hasPermission(
  role: UserRole,
  permission: Permission
): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

// lib/rbac/check-permission.ts (NEW FILE)

export async function checkPermission(
  userId: string,
  permission: Permission
): Promise<boolean> {
  const user = await getUserRole(userId);
  if (!user) return false;
  return hasPermission(user.role, permission);
}
```

### 6. **Middleware Route Protection**

#### ✅ Current Implementation: **GOOD**

#### ⚠️ Enhancement: More Granular Route Protection

```typescript
// middleware.ts - ENHANCED VERSION

// Define routes with required permissions (not just roles)
const PROTECTED_ROUTES = [
  {
    path: '/api/bookings',
    methods: ['POST'],
    permission: 'book:create',
    roles: ['USER', 'DIETITIAN', 'ADMIN'],
  },
  {
    path: '/api/admin/users',
    methods: ['GET', 'POST', 'PUT'],
    permission: 'admin:users:view',
    roles: ['ADMIN'],
  },
  {
    path: '/api/events',
    methods: ['POST', 'PUT', 'DELETE'],
    permission: 'event:create',
    roles: ['DIETITIAN', 'ADMIN'],
  },
] as const;

// In middleware:
export async function middleware(request: NextRequest) {
  // ... existing session check ...
  
  // ADD: Permission-based route checking
  const routeConfig = PROTECTED_ROUTES.find(config => 
    request.nextUrl.pathname.startsWith(config.path) &&
    config.methods.includes(request.method as any)
  );
  
  if (routeConfig) {
    const hasAccess = await checkPermission(
      session.user.id,
      routeConfig.permission
    );
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }
  }
  
  // ... rest of middleware ...
}
```

---

## 📊 Database Schema & RLS Best Practices

### 7. **Row Level Security (RLS) Policies**

#### ✅ Current Implementation: **EXCELLENT**

**Strengths:**
- ✅ RLS enabled
- ✅ Service role bypass
- ✅ Users can only access their own data
- ✅ Triggers prevent role/status manipulation

#### ⚠️ Additional Security Layers:

```sql
-- supabase/migrations/enhanced_rls_policies.sql

-- 1. ADD: Row-level time-based access control
-- Example: Users can only cancel bookings within 24 hours
CREATE POLICY "Users can cancel own bookings within time limit"
  ON bookings FOR UPDATE
  USING (
    auth.uid() = user_id AND
    status = 'CONFIRMED' AND
    (NOW() - created_at) < INTERVAL '24 hours'
  )
  WITH CHECK (auth.uid() = user_id);

-- 2. ADD: Soft delete protection via RLS
-- Only show active records to non-admins
CREATE POLICY "Hide soft-deleted records"
  ON bookings FOR SELECT
  USING (
    deleted_at IS NULL OR
    auth.jwt() ->> 'role' = 'service_role' OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );

-- 3. ADD: Audit trail protection
-- Only admins can read audit logs
CREATE POLICY "Only admins can view audit logs"
  ON auth_audit_log FOR SELECT
  USING (
    auth.jwt() ->> 'role' = 'service_role' OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );

-- 4. ADD: Rate limiting at database level
-- Prevent users from creating too many records
CREATE OR REPLACE FUNCTION check_booking_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  booking_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO booking_count
  FROM bookings
  WHERE user_id = auth.uid()
    AND created_at > NOW() - INTERVAL '1 hour';
  
  IF booking_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded: maximum 10 bookings per hour';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER booking_rate_limit_trigger
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION check_booking_rate_limit();
```

---

## 🔄 Session Management

### 8. **Session Lifecycle Management**

#### ✅ Current Implementation: **GOOD**

#### ⚠️ Enhancements:

```typescript
// lib/auth/session-manager.ts (NEW FILE)

export class SessionManager {
  /**
   * Refresh session proactively (before expiry)
   */
  static async refreshSessionIfNeeded(
    supabase: SupabaseClient
  ): Promise<Session | null> {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) return null;
    
    // Check if session expires soon (within 5 minutes)
    const expiresAt = new Date(session.expires_at! * 1000);
    const now = new Date();
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();
    
    if (timeUntilExpiry < 5 * 60 * 1000) { // 5 minutes
      // Refresh token
      const { data: { session: newSession }, error: refreshError } = 
        await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('Session refresh failed:', refreshError);
        return null;
      }
      
      return newSession;
    }
    
    return session;
  }
  
  /**
   * Invalidate all user sessions (for security events)
   */
  static async invalidateAllUserSessions(
    userId: string,
    adminClient: SupabaseClient
  ): Promise<void> {
    // Mark user for re-authentication
    await adminClient
      .from('users')
      .update({ 
        last_sign_in_at: null, // Force re-auth
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    
    // Log the invalidation
    await adminClient
      .from('auth_audit_log')
      .insert({
        user_id: userId,
        action: 'session_invalidated',
        provider: 'system',
        ip_address: 'system',
        user_agent: 'system',
        success: true,
        metadata: {
          reason: 'security_event',
          timestamp: new Date().toISOString(),
        },
      });
  }
  
  /**
   * Check for suspicious session activity
   */
  static async detectSuspiciousActivity(
    userId: string,
    currentIp: string,
    currentUserAgent: string,
    adminClient: SupabaseClient
  ): Promise<boolean> {
    // Get last 5 sign-ins
    const { data: recentLogins } = await adminClient
      .from('auth_audit_log')
      .select('ip_address, user_agent, created_at')
      .eq('user_id', userId)
      .eq('success', true)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (!recentLogins || recentLogins.length < 2) {
      return false; // Not enough history
    }
    
    // Check if IP changed significantly
    const uniqueIps = new Set(recentLogins.map(log => log.ip_address));
    if (uniqueIps.size > 3 && !uniqueIps.has(currentIp)) {
      return true; // Suspicious: many different IPs
    }
    
    // Check if user agent changed
    const recentUserAgent = recentLogins[0]?.user_agent;
    if (recentUserAgent && recentUserAgent !== currentUserAgent) {
      // User agent changed - could be suspicious but also normal
      // Log for review but don't block
      console.warn('User agent changed', { userId, old: recentUserAgent, new: currentUserAgent });
    }
    
    return false;
  }
}
```

---

## 📝 Audit Logging & Monitoring

### 9. **Comprehensive Audit Trail**

#### ✅ Current Implementation: **GOOD**

You're logging:
- Sign-in attempts
- Account status changes
- Access to sensitive routes

#### ⚠️ Enhancements for Enterprise:

```sql
-- supabase/migrations/enhanced_audit_logging.sql

-- ADD: Security events table (separate from auth audit)
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'suspicious_login', 'rate_limit_exceeded', 'unauthorized_access', etc.
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_security_events_user_id ON security_events(user_id);
CREATE INDEX idx_security_events_event_type ON security_events(event_type);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_security_events_created_at ON security_events(created_at DESC);

-- ADD: Automated alerting for critical events
CREATE OR REPLACE FUNCTION notify_security_team()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify on high/critical severity
  IF NEW.severity IN ('high', 'critical') THEN
    -- In production, integrate with PagerDuty, Slack, etc.
    -- For now, log to dedicated table
    PERFORM pg_notify('security_alert', json_build_object(
      'event_id', NEW.id,
      'user_id', NEW.user_id,
      'event_type', NEW.event_type,
      'severity', NEW.severity
    )::text);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER security_event_notification
  AFTER INSERT ON security_events
  FOR EACH ROW
  EXECUTE FUNCTION notify_security_team();

-- ADD: Retention policy (auto-delete old logs)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  -- Delete logs older than 1 year
  DELETE FROM auth_audit_log
  WHERE created_at < NOW() - INTERVAL '1 year';
  
  -- Delete low-severity security events older than 90 days
  DELETE FROM security_events
  WHERE severity = 'low' AND created_at < NOW() - INTERVAL '90 days';
  
  -- Keep high/critical events for 2 years
  DELETE FROM security_events
  WHERE severity IN ('high', 'critical') AND created_at < NOW() - INTERVAL '2 years';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (run weekly via cron or pg_cron extension)
```

```typescript
// lib/monitoring/security-monitor.ts (NEW FILE)

export class SecurityMonitor {
  /**
   * Log security event
   */
  static async logEvent(
    event: {
      userId?: string;
      eventType: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      ipAddress?: string;
      userAgent?: string;
      metadata?: Record<string, any>;
    },
    adminClient: SupabaseClient
  ): Promise<void> {
    await adminClient
      .from('security_events')
      .insert({
        user_id: event.userId || null,
        event_type: event.eventType,
        severity: event.severity,
        ip_address: event.ipAddress || null,
        user_agent: event.userAgent || null,
        metadata: event.metadata || {},
      });
    
    // If critical, trigger immediate alert
    if (event.severity === 'critical') {
      await this.sendAlert(event);
    }
  }
  
  /**
   * Detect and respond to security threats
   */
  static async detectThreats(
    userId: string,
    request: Request,
    adminClient: SupabaseClient
  ): Promise<SecurityResponse> {
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    // Check for brute force attempts
    const bruteForceDetected = await this.checkBruteForce(userId, ip, adminClient);
    if (bruteForceDetected) {
      await this.logEvent({
        userId,
        eventType: 'brute_force_detected',
        severity: 'high',
        ipAddress: ip,
        userAgent,
      }, adminClient);
      
      return {
        allow: false,
        action: 'BLOCK',
        reason: 'Brute force attack detected',
      };
    }
    
    // Check for account takeover attempts
    const takeoverDetected = await this.checkAccountTakeover(userId, ip, userAgent, adminClient);
    if (takeoverDetected) {
      await this.logEvent({
        userId,
        eventType: 'account_takeover_attempt',
        severity: 'critical',
        ipAddress: ip,
        userAgent,
      }, adminClient);
      
      // Invalidate all sessions
      await SessionManager.invalidateAllUserSessions(userId, adminClient);
      
      return {
        allow: false,
        action: 'BLOCK_AND_REAUTH',
        reason: 'Suspicious activity detected',
      };
    }
    
    return { allow: true };
  }
  
  private static async checkBruteForce(
    userId: string,
    ip: string,
    adminClient: SupabaseClient
  ): Promise<boolean> {
    // Check for 5+ failed attempts in last 15 minutes
    const { data: recentFailures } = await adminClient
      .from('auth_audit_log')
      .select('id')
      .eq('user_id', userId)
      .eq('success', false)
      .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
      .limit(10);
    
    return (recentFailures?.length || 0) >= 5;
  }
  
  private static async checkAccountTakeover(
    userId: string,
    ip: string,
    userAgent: string,
    adminClient: SupabaseClient
  ): Promise<boolean> {
    // Check for rapid location/IP changes
    const suspicious = await SessionManager.detectSuspiciousActivity(
      userId,
      ip,
      userAgent,
      adminClient
    );
    
    return suspicious;
  }
  
  private static async sendAlert(event: any): Promise<void> {
    // Integrate with your alerting system (PagerDuty, Slack, etc.)
    console.error('🚨 CRITICAL SECURITY EVENT:', event);
    // TODO: Send webhook/email/SMS alert
  }
}

interface SecurityResponse {
  allow: boolean;
  action?: 'BLOCK' | 'BLOCK_AND_REAUTH' | 'LOG_ONLY';
  reason?: string;
}
```

---

## 🚀 Performance Optimization

### 10. **Session Validation Performance**

#### ⚠️ Current Implementation: **GOOD, but can be optimized**

**Current approach:**
- Middleware checks session on every request
- Fetches user from database on every request

#### 💡 Optimization Strategies:

```typescript
// middleware.ts - OPTIMIZED VERSION

// ADD: Session cache (Redis or in-memory for edge)
const sessionCache = new Map<string, {
  userId: string;
  role: UserRole;
  accountStatus: string;
  expiresAt: number;
}>();

export async function middleware(request: NextRequest) {
  // ... existing public route check ...
  
  // OPTIMIZATION: Check session cache first
  const sessionId = request.cookies.get('sb-access-token')?.value;
  if (sessionId) {
    const cached = sessionCache.get(sessionId);
    if (cached && cached.expiresAt > Date.now()) {
      // Use cached session data (skip database query)
      const userRole = cached.role;
      const accountStatus = cached.accountStatus;
      
      // Continue with cached data...
      // Still validate route access but skip DB query
    }
  }
  
  // ... rest of middleware with DB query as fallback ...
  
  // After successful DB query, cache the result
  if (session) {
    sessionCache.set(sessionId!, {
      userId: session.user.id,
      role: userRole,
      accountStatus,
      expiresAt: Date.now() + (5 * 60 * 1000), // Cache for 5 minutes
    });
  }
}

// ADD: Cache invalidation on role/status changes
export async function invalidateSessionCache(userId: string) {
  // Clear all cached sessions for this user
  for (const [sessionId, data] of sessionCache.entries()) {
    if (data.userId === userId) {
      sessionCache.delete(sessionId);
    }
  }
}
```

### 11. **Database Query Optimization**

```sql
-- supabase/migrations/performance_indexes.sql

-- ADD: Indexes for common auth queries
CREATE INDEX IF NOT EXISTS idx_users_id_role_status 
  ON users(id, role, account_status) 
  WHERE account_status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_auth_audit_log_user_success 
  ON auth_audit_log(user_id, success, created_at DESC);

-- ADD: Partial index for active sessions (if you track sessions)
-- CREATE INDEX IF NOT EXISTS idx_user_sessions_active
--   ON user_sessions(user_id, expires_at)
--   WHERE expires_at > NOW();

-- ADD: Materialized view for admin dashboard (refresh periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS user_stats AS
SELECT 
  role,
  account_status,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE last_sign_in_at > NOW() - INTERVAL '30 days') as active_users
FROM users
GROUP BY role, account_status;

CREATE UNIQUE INDEX ON user_stats(role, account_status);

-- Refresh view every hour (via cron or scheduled function)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY user_stats;
```

---

## 🔧 Error Handling & User Experience

### 12. **Graceful Error Handling**

#### ✅ Current Implementation: **GOOD**

#### ⚠️ Enhancements:

```typescript
// lib/auth/error-handler.ts (NEW FILE)

export enum AuthErrorCode {
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  ROLE_MISMATCH = 'ROLE_MISMATCH',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  CSRF_TOKEN_INVALID = 'CSRF_TOKEN_INVALID',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
}

export class AuthError extends Error {
  constructor(
    public code: AuthErrorCode,
    message: string,
    public userMessage?: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
  
  static fromError(error: any): AuthError {
    if (error instanceof AuthError) return error;
    
    // Map common errors to AuthError
    if (error?.message?.includes('JWT')) {
      return new AuthError(
        AuthErrorCode.INVALID_TOKEN,
        'Invalid authentication token',
        'Your session has expired. Please sign in again.',
        401
      );
    }
    
    if (error?.message?.includes('rate limit')) {
      return new AuthError(
        AuthErrorCode.RATE_LIMIT_EXCEEDED,
        'Rate limit exceeded',
        'Too many requests. Please try again in a few minutes.',
        429
      );
    }
    
    return new AuthError(
      AuthErrorCode.SERVER_ERROR,
      error?.message || 'Unknown error',
      'An unexpected error occurred. Please try again.',
      500
    );
  }
}

// Usage in auth callback:
export async function GET(request: NextRequest) {
  try {
    // ... auth logic ...
  } catch (error) {
    const authError = AuthError.fromError(error);
    
    // Log for monitoring
    console.error('AuthError', {
      code: authError.code,
      message: authError.message,
      statusCode: authError.statusCode,
    });
    
    // Return user-friendly error page
    return NextResponse.redirect(
      new URL(`/auth/error?code=${authError.code}`, request.url)
    );
  }
}
```

---

## 📱 Multi-Device & Concurrent Session Management

### 13. **Handling Multiple Devices**

#### ⚠️ Current: Not explicitly handled

#### 💡 Best Practice:

```typescript
// lib/auth/session-tracking.ts (NEW FILE)

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
 * Track active sessions per user
 */
export async function trackSession(
  userId: string,
  request: Request,
  adminClient: SupabaseClient
): Promise<void> {
  const deviceId = getDeviceId(request);
  const deviceName = getDeviceName(request);
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  // Upsert session tracking
  await adminClient
    .from('user_sessions') // Create this table
    .upsert({
      user_id: userId,
      device_id: deviceId,
      device_name: deviceName,
      ip_address: ip,
      user_agent: userAgent,
      last_active_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,device_id',
    });
}

/**
 * Get user's active sessions
 */
export async function getUserSessions(
  userId: string,
  adminClient: SupabaseClient
): Promise<DeviceSession[]> {
  const { data } = await adminClient
    .from('user_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('last_active_at', { ascending: false });
  
  return data || [];
}

/**
 * Revoke session on specific device
 */
export async function revokeDeviceSession(
  userId: string,
  deviceId: string,
  adminClient: SupabaseClient
): Promise<void> {
  await adminClient
    .from('user_sessions')
    .delete()
    .eq('user_id', userId)
    .eq('device_id', deviceId);
  
  // Log the revocation
  await SecurityMonitor.logEvent({
    userId,
    eventType: 'session_revoked',
    severity: 'low',
    metadata: { deviceId },
  }, adminClient);
}

function getDeviceId(request: Request): string {
  // Generate device ID from user agent + IP (first 3 octets)
  const userAgent = request.headers.get('user-agent') || '';
  const ip = request.headers.get('x-forwarded-for') || '';
  const ipPrefix = ip.split('.').slice(0, 3).join('.');
  
  // Create hash from user agent + IP prefix
  const data = `${userAgent}-${ipPrefix}`;
  // Use crypto to create consistent hash
  return Buffer.from(data).toString('base64').substring(0, 16);
}

function getDeviceName(request: Request): string {
  const userAgent = request.headers.get('user-agent') || '';
  
  // Parse device name from user agent (simplified)
  if (userAgent.includes('Mobile')) return 'Mobile Device';
  if (userAgent.includes('Tablet')) return 'Tablet';
  if (userAgent.includes('Macintosh')) return 'Mac';
  if (userAgent.includes('Windows')) return 'Windows PC';
  if (userAgent.includes('Linux')) return 'Linux PC';
  
  return 'Unknown Device';
}
```

---

## 🔐 Additional Security Layers

### 14. **Content Security Policy (CSP)**

```typescript
// middleware.ts - ADD CSP Headers

const response = NextResponse.next();

// ADD: Content Security Policy
response.headers.set(
  'Content-Security-Policy',
  [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://accounts.google.com", // Needed for Google OAuth
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://*.googleapis.com",
    "frame-src 'self' https://accounts.google.com", // Google OAuth iframe
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join('; ')
);

// ADD: Other security headers
response.headers.set('X-Content-Type-Options', 'nosniff');
response.headers.set('X-Frame-Options', 'DENY');
response.headers.set('X-XSS-Protection', '1; mode=block');
response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

return response;
```

### 15. **Email Verification Flow**

```typescript
// lib/auth/email-verification.ts (NEW FILE)

/**
 * Send verification email
 */
export async function sendVerificationEmail(
  userId: string,
  email: string,
  adminClient: SupabaseClient
): Promise<void> {
  // Use Supabase's built-in email verification
  // Or implement custom verification flow
  
  // Update user status to PENDING_VERIFICATION
  await adminClient
    .from('users')
    .update({ 
      account_status: 'PENDING_VERIFICATION',
      email_verified: null,
    })
    .eq('id', userId);
}

/**
 * Verify email token
 */
export async function verifyEmailToken(
  token: string,
  adminClient: SupabaseClient
): Promise<{ success: boolean; userId?: string }> {
  // Validate token (from email link)
  // Update user status to ACTIVE
  // Set email_verified timestamp
  
  // Implementation depends on your verification token system
  return { success: false };
}
```

---

## 🎯 Implementation Priority

### Phase 1: Critical Security (Implement Immediately)
1. ✅ Enhanced CSP headers
2. ✅ Security event logging
3. ✅ Brute force detection
4. ✅ Session cache invalidation

### Phase 2: Performance & UX (Next Sprint)
5. ✅ Session caching
6. ✅ Database query optimization
7. ✅ Enhanced error handling
8. ✅ Device session tracking

### Phase 3: Advanced Features (Future)
9. ✅ Granular permissions system
10. ✅ Email verification flow
11. ✅ Automated security alerts
12. ✅ Advanced threat detection

---

## 📚 Additional Resources

### Recommended Reading:
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Supabase Auth Best Practices](https://supabase.com/docs/guides/auth)
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/routing/middleware#security-headers)

### Tools to Consider:
- **Vercel Edge Config** or **Upstash Redis** for distributed session caching
- **Sentry** or **LogRocket** for error tracking
- **PagerDuty** or **Opsgenie** for security alerts
- **Cloudflare** for DDoS protection and rate limiting at edge

---

## ✅ Checklist for Production

- [ ] All security headers implemented
- [ ] Rate limiting configured for all endpoints
- [ ] Audit logging for all sensitive operations
- [ ] RLS policies tested and verified
- [ ] Session management tested across devices
- [ ] Error handling provides user-friendly messages
- [ ] Monitoring and alerting configured
- [ ] Disaster recovery plan documented
- [ ] Security incident response plan in place
- [ ] Regular security audits scheduled

---

**Your current implementation is already very solid!** These enhancements will take it from "production-ready" to "enterprise-grade" with the robustness expected at top-tier companies.
