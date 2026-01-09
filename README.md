# Multi-Tenant SaaS Analytics Dashboard

A production-grade, multi-tenant analytics platform built with Next.js 14, PostgreSQL, and deployed on Vercel. Features real-time data ingestion, time-series analytics, and statistical anomaly detection.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue)

## 🚀 Features

### Core Capabilities
- **Multi-Tenant Architecture**: Complete data isolation per organization with tenant_id filtering
- **Role-Based Access Control**: OWNER, ADMIN, and MEMBER roles with granular permissions
- **CSV Data Ingestion**: Upload CSV files with automatic schema inference and intelligent field mapping
- **Real-Time Analytics**: Time-series charts with aggregations (sum, avg, count, min, max, stddev)
- **Anomaly Detection**: Statistical anomaly detection using Z-score and trend analysis
- **Secure Authentication**: Clerk-based authentication with OAuth support
- **Production-Ready**: Type-safe, scalable architecture optimized for Vercel deployment

### Technical Highlights
- Server Components by default for optimal performance
- Server Actions for type-safe mutations
- PostgreSQL with Row Level Security (RLS) ready
- Optimized database queries with proper indexing
- Responsive design with Tailwind CSS
- Chart visualizations with Recharts

## 📋 Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Multi-Tenancy Strategy](#multi-tenancy-strategy)
- [Database Schema](#database-schema)
- [Local Development](#local-development)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Key Design Decisions](#key-design-decisions)

## 🏗️ Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Layer                         │
│  (Next.js App Router, React Server Components, Tailwind)    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Authentication Layer                      │
│              (Clerk Middleware + Auth Context)              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Application Layer                       │
│        (Server Actions, Route Handlers, RBAC Logic)         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Business Logic                         │
│  (CSV Parser, Analytics Engine, Anomaly Detection)          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Data Layer                            │
│     (Type-Safe Query Layer + PostgreSQL with Neon)          │
└─────────────────────────────────────────────────────────────┘
```

### Request Flow

1. **Authentication**: Clerk middleware validates user session
2. **Authorization**: Auth context retrieves user + tenant membership + role
3. **Permission Check**: RBAC verifies user has required permissions
4. **Data Access**: All queries automatically filtered by tenant_id
5. **Response**: Type-safe data returned to client

## 🛠️ Tech Stack

### Frontend
- **Next.js 14**: App Router with React Server Components
- **TypeScript**: Full type safety across the application
- **Tailwind CSS**: Utility-first styling
- **Recharts**: Data visualization library

### Backend
- **Next.js Server Actions**: Type-safe server mutations
- **PostgreSQL**: Primary database (via Neon)
- **Neon Serverless**: Postgres client optimized for serverless

### Authentication
- **Clerk**: Modern authentication with social OAuth

### Data Processing
- **PapaParse**: CSV parsing with schema inference
- **date-fns**: Date manipulation and formatting

### Deployment
- **Vercel**: Optimized for Next.js with edge capabilities

## 🔐 Multi-Tenancy Strategy

### Tenant Isolation Approach

This application implements **tenant-based isolation** using a `tenant_id` column across all tenant-scoped tables.

#### Key Principles

1. **Every Query Filtered**: All data access queries include `tenant_id` in WHERE clauses
2. **Enforced at Application Layer**: Authorization checks happen before data access
3. **Row-Level Security Ready**: Database schema has RLS enabled (policies can be added)
4. **Foreign Key Constraints**: Ensures referential integrity within tenant boundaries
5. **Indexed for Performance**: `tenant_id` columns are indexed on all tables

### Authorization Flow

```typescript
// 1. Get authenticated user context
const authContext = await getAuthContext();

// 2. Verify tenant membership and get role
const tenantAuth = await getTenantAuthContext(tenantId);

// 3. Check permissions
if (!canUploadFiles(tenantAuth.role)) {
  throw new Error('Insufficient permissions');
}

// 4. All queries automatically include tenant_id
const events = await getAnalyticsEvents(tenantId, eventType);
```

### Role-Based Access Control (RBAC)

| Role   | View Analytics | Upload Files | Delete Files | Manage Members | Manage Tenant |
|--------|---------------|--------------|--------------|----------------|---------------|
| OWNER  | ✅            | ✅           | ✅           | ✅             | ✅            |
| ADMIN  | ✅            | ✅           | ✅           | ❌             | ❌            |
| MEMBER | ✅            | ❌           | ❌           | ❌             | ❌            |

## 🗄️ Database Schema

### Core Tables

**tenants**: Organizations/workspaces
- `id`: UUID primary key
- `name`: Organization name
- `slug`: URL-friendly identifier
- `status`: active, suspended, deleted
- `settings`: JSONB for flexible configuration

**users**: Application users
- `id`: UUID primary key
- `clerk_user_id`: External auth ID
- `email`: User email (unique)

**tenant_members**: User-tenant relationships
- `tenant_id`: FK to tenants
- `user_id`: FK to users
- `role`: OWNER, ADMIN, MEMBER
- Unique constraint on (tenant_id, user_id)

**analytics_events**: Raw event data
- `tenant_id`: FK to tenants (indexed)
- `event_type`: Event category
- `event_timestamp`: When event occurred (indexed)
- `metric_value`: Numeric metric
- `dimensions`: JSONB for flexible attributes
- `raw_data`: JSONB for full event data

**aggregated_metrics**: Pre-computed aggregations
- Aggregates by hour/day/week/month
- Stores count, sum, avg, min, max, stddev
- Unique constraint prevents duplicate computations

**anomaly_results**: Detected anomalies
- `anomaly_type`: spike, drop, outlier
- `severity`: low, medium, high, critical
- `deviation_percentage`: How much it deviates
- `acknowledged`: Whether reviewed by user

### Indexes

All tenant-scoped tables have composite indexes:
```sql
CREATE INDEX idx_analytics_events_tenant
  ON analytics_events(tenant_id, event_timestamp DESC);

CREATE INDEX idx_analytics_events_type
  ON analytics_events(tenant_id, event_type, event_timestamp DESC);
```

## 🚀 Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL database (Neon recommended for easy setup)
- Clerk account (free tier available)

### Setup Steps

1. **Clone and install dependencies**
```bash
npm install
```

2. **Set up PostgreSQL database**
   - Create a database on [Neon](https://neon.tech) (free tier)
   - Run the schema: `db/schema.sql`

3. **Configure Clerk**
   - Create an application at [Clerk.com](https://clerk.com)
   - Enable email/social authentication
   - Copy your API keys

4. **Environment variables**
```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:
```env
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
```

5. **Run development server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Running the Database Schema

```bash
# Using psql
psql $DATABASE_URL -f db/schema.sql

# Or using a database client UI (TablePlus, pgAdmin, etc.)
```

## 📦 Deployment

### Vercel Deployment (Recommended)

1. **Push to GitHub**
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your repository
   - Add environment variables (same as .env.local)
   - Deploy

3. **Update Clerk URLs**
   - Go to Clerk Dashboard → Paths
   - Add your Vercel domain to allowed origins
   - Update redirect URLs if needed

### Environment Variables on Vercel

Add these in Vercel Project Settings → Environment Variables:
- `DATABASE_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_APP_URL` (your Vercel domain)

### Vercel Free Tier Compatibility

✅ **What's included:**
- Serverless Functions (unlimited)
- Edge Functions
- 100GB bandwidth/month
- Automatic HTTPS
- Preview deployments

⚠️ **Considerations:**
- Function execution limit: 10s (sufficient for our use case)
- No persistent file storage (we use database only)
- Database hosted externally (Neon free tier: 0.5GB)

## 🔧 Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/db` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key | `pk_test_...` |
| `CLERK_SECRET_KEY` | Clerk secret key | `sk_test_...` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_FILE_SIZE_BYTES` | `10485760` | Max CSV upload size (10MB) |
| `ANOMALY_DETECTION_SENSITIVITY` | `3` | Sensitivity level 1-5 |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Application URL |

## 📁 Project Structure

```
saas/
├── app/                          # Next.js 14 App Router
│   ├── layout.tsx               # Root layout with Clerk
│   ├── page.tsx                 # Landing page
│   ├── sign-in/                 # Clerk sign-in
│   ├── sign-up/                 # Clerk sign-up
│   ├── onboarding/              # Tenant creation
│   └── dashboard/
│       ├── page.tsx             # Tenant selection
│       └── [tenantId]/
│           └── page.tsx         # Main analytics dashboard
├── components/
│   ├── ui/
│   │   └── chart.tsx           # Recharts wrapper
│   └── dashboard/
│       ├── upload-form.tsx     # CSV upload UI
│       └── anomaly-list.tsx    # Anomaly display
├── actions/                     # Server Actions
│   ├── tenant.ts               # Tenant operations
│   ├── upload.ts               # File upload handler
│   └── analytics.ts            # Analytics queries
├── lib/
│   ├── db/
│   │   ├── index.ts            # Database client
│   │   ├── types.ts            # TypeScript types
│   │   └── queries.ts          # Type-safe queries
│   ├── csv/
│   │   └── parser.ts           # CSV parsing + schema inference
│   ├── analytics/
│   │   ├── aggregation.ts      # Time-series aggregations
│   │   └── anomaly-detection.ts # Anomaly detection algorithms
│   └── auth/
│       ├── context.ts          # Auth context helpers
│       └── permissions.ts      # RBAC logic
├── db/
│   └── schema.sql              # PostgreSQL schema
├── middleware.ts               # Clerk auth middleware
└── .env.example                # Environment template
```

## 🎯 Key Design Decisions

### 1. Server Components First
- Default to Server Components for data fetching
- Client Components only for interactivity
- Reduces JavaScript bundle size

### 2. Server Actions for Mutations
- Type-safe data mutations
- No API routes needed for most operations
- Automatic revalidation with `revalidatePath`

### 3. Tenant Filtering in Application Layer
- All queries manually include `tenant_id`
- Authorization checked before every data access
- RLS enabled as defense-in-depth

### 4. CSV Schema Inference
- Automatically detects column types
- Maps columns to event schema intelligently
- Fallback to sensible defaults

### 5. Anomaly Detection Algorithm
- **Z-Score Method**: Detects outliers based on standard deviation
- **Trend Analysis**: Identifies sudden spikes/drops
- **Configurable Sensitivity**: Adjustable threshold (1-5)
- Statistical approach suitable for time-series data

### 6. Pre-Aggregation Strategy
- Aggregated metrics table for performance
- Computed on-demand, cached in database
- Falls back to raw queries if not available

### 7. Type Safety Throughout
- TypeScript interfaces for all database models
- Zod schemas for validation (where needed)
- Type-safe Server Actions

## 📊 Analytics Features

### Data Ingestion
- CSV upload with validation
- Schema inference (string, number, integer, timestamp, boolean)
- Automatic field mapping to event model
- Supports custom dimensions via JSONB

### Aggregations
- Time-based grouping (hour, day, week, month)
- Statistical functions (count, sum, avg, min, max, stddev)
- Efficient SQL queries with proper indexes

### Anomaly Detection
- **Outlier Detection**: Z-score based (configurable std dev threshold)
- **Trend Detection**: Identifies sudden changes between periods
- **Severity Levels**: low, medium, high, critical
- **Acknowledgment System**: Track reviewed anomalies

## 🔒 Security Considerations

1. **Authentication**: Clerk handles auth securely
2. **Authorization**: RBAC enforced on every request
3. **Data Isolation**: tenant_id filtering on all queries
4. **SQL Injection**: Using parameterized queries
5. **XSS Protection**: React escapes output by default
6. **HTTPS**: Enforced by Vercel
7. **Environment Variables**: Never committed to git

## 🚦 Performance Optimizations

1. **Database Indexes**: All query patterns indexed
2. **Aggregated Metrics**: Pre-computed for common queries
3. **Server Components**: Reduced client JavaScript
4. **Efficient Queries**: Limit results, proper WHERE clauses
5. **Neon Serverless**: Auto-scaling database

## 📈 Scaling Considerations

### Current Architecture (Free Tier)
- Handles ~10k events/tenant comfortably
- Suitable for 10-50 active tenants
- Query performance < 500ms for typical dashboards

### Future Enhancements
- **Caching Layer**: Redis for aggregated data
- **Background Jobs**: Queue for heavy processing
- **Read Replicas**: Separate analytics queries
- **Partitioning**: Partition large tables by tenant_id
- **CDN**: Cache static dashboard components

## 🧪 Testing Recommendations

```bash
# Unit tests for business logic
npm test

# Integration tests for Server Actions
npm run test:integration

# E2E tests with Playwright
npm run test:e2e
```

## 📝 License

MIT License - feel free to use this project as a template for your SaaS applications.

## 🤝 Contributing

Contributions welcome! This is a reference implementation showcasing production-grade patterns.

## 📞 Support

For issues or questions:
- Open a GitHub issue
- Check the documentation above
- Review the code comments

---

**Built with ❤️ using Next.js 14, PostgreSQL, and Clerk**
