# 🏥 Daiyet - Dietitian Booking Platform

> Full-stack healthcare consultation platform built with modern web technologies

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Latest-green)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8)](https://tailwindcss.com/)

## 🚀 Overview

Daiyet is a production-ready platform connecting dietitians with clients for consultations and meal plan delivery. The application demonstrates enterprise-grade architecture patterns, real-time systems, and secure payment processing.

## ✨ Key Features

- 🔐 **Enterprise Authentication** - Supabase Auth with Google OAuth, role-based access control
- 📅 **Calendar Integration** - Google Calendar sync for appointment management
- 💳 **Payment Processing** - Paystack integration for secure transactions
- 📄 **Meal Plan Delivery** - Secure PDF upload and delivery system
- 🔄 **Real-time Updates** - Server-Sent Events (SSE) for live data synchronization
- 👥 **Multi-role System** - Dietitian, User, and Admin dashboards
- 🛡️ **Security** - Row-Level Security (RLS), rate limiting, audit logging
- 📊 **Session Management** - Request/approval workflow with status tracking

## 🛠️ Tech Stack

### Core
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript 5.9
- **Styling:** Tailwind CSS 4
- **UI Components:** Radix UI, Lucide Icons

### Backend & Database
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth + Google OAuth
- **Storage:** Supabase Storage (PDF files)
- **Real-time:** Server-Sent Events (SSE)

### Integrations
- **Payments:** Paystack API
- **Calendar:** Google Calendar API
- **Email:** Supabase Email Service

## 🏗️ Architecture Highlights

### Authentication & Authorization
- Context-aware Supabase clients (browser/server/admin)
- PKCE flow for OAuth
- HttpOnly cookie-based session management
- Role-based access control middleware
- Account status validation (ACTIVE/SUSPENDED/PENDING)

### Real-time Systems
- Server-Sent Events for live updates
- Optimized availability fetching
- Real-time booking status synchronization

### File Management
- Transaction-based PDF uploads
- Automatic cleanup on failure
- Race condition prevention
- Secure file validation

### Security
- Row-Level Security (RLS) policies
- Rate limiting on auth endpoints
- Comprehensive audit logging
- CSRF protection
- Input sanitization

## 📁 Project Structure

```
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── dashboard/         # Role-based dashboards
│   ├── auth/              # Authentication flows
│   └── user-dashboard/    # User interface
├── components/            # React components
│   ├── auth/              # Authentication UI
│   ├── booking/           # Booking components
│   └── session-request/   # Session management
├── lib/                   # Utilities & services
│   ├── supabase/          # Supabase client factories
│   ├── auth/              # Auth helpers
│   └── google-calendar.ts # Calendar integration
├── hooks/                 # Custom React hooks
│   ├── useSessionRequestsStream.ts
│   └── useBookingsStream.ts
└── supabase/             # Database migrations
    └── migrations/        # SQL migrations
```

## 🚦 Getting Started

### Prerequisites
- Node.js 18+
- npm/yarn/pnpm
- Supabase account
- Google OAuth credentials
- Paystack API keys

### Installation

```bash
# Clone the repository
git clone https://github.com/michaelasereoo/daiyet-app.git
cd daiyet-app

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your Supabase, Google, and Paystack credentials

# Run database migrations
# (See SUPABASE_SETUP.md for details)

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 📚 Documentation

- [Authentication Architecture](./AUTHENTICATION_CONCEPT_REVIEW.md)
- [PDF Upload Flow](./PDF_UPLOAD_FLOW.md)
- [Supabase Setup](./SUPABASE_SETUP.md)
- [Enterprise Auth Solution](./ENTERPRISE_AUTH_SOLUTION.md)

## 🔒 Security Features

- ✅ Row-Level Security (RLS) policies
- ✅ Rate limiting on sensitive endpoints
- ✅ Audit logging for authentication events
- ✅ CSRF protection via state parameters
- ✅ Secure file upload validation
- ✅ Transaction rollback on failures
- ✅ Input sanitization and validation

## 🎯 Key Demonstrations

This project showcases expertise in:

1. **Modern React Patterns** - Server Components, Client Components, Server Actions
2. **Real-time Systems** - Server-Sent Events implementation
3. **Authentication** - Enterprise-grade OAuth flow with Supabase
4. **Database Design** - RLS policies, migrations, relationships
5. **Payment Integration** - Paystack webhook handling
6. **File Management** - Secure uploads with cleanup
7. **Error Handling** - Comprehensive error boundaries and logging
8. **Type Safety** - Full TypeScript implementation

## 📝 License

This project is private and proprietary.

## 👤 Author

**Michael Asere**
- GitHub: [@michaelasereoo](https://github.com/michaelasereoo)

---

**Note:** This is a production application. Sensitive credentials and API keys should be kept secure and never committed to version control.
