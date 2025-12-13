// Admin email - only this email can access admin dashboard
export const ADMIN_EMAIL = "asereopeyemimichael@gmail.com";

export const authConfig = {
  // Environment-specific settings
  development: {
    cookieOptions: {
      secure: false,
      sameSite: 'lax' as const,
      path: '/',
    },
    sessionRefreshInterval: 60 * 1000, // 1 minute
  },
  production: {
    cookieOptions: {
      secure: true,
      sameSite: 'strict' as const,
      path: '/',
      domain: process.env.COOKIE_DOMAIN,
      httpOnly: true,
    },
    sessionRefreshInterval: 5 * 60 * 1000, // 5 minutes
  },

  // OAuth providers configuration
  providers: {
    google: {
      scopes: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'openid',
      ],
      additionalParams: {
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
      },
    },
  },

  // Role-based redirects
  redirects: {
    DIETITIAN: '/dashboard',
    USER: '/user-dashboard',
    ADMIN: '/admin',
    default: '/',
  },

  // Session management
  session: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
} as const;

// Get current environment config
export function getAuthConfig() {
  const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';
  return {
    ...authConfig,
    current: authConfig[env],
  };
}
