# Quick Setup Guide

This guide will help you get the Multi-Tenant SaaS Analytics Dashboard running locally in under 10 minutes.

## Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] A Neon database account (free)
- [ ] A Clerk account (free)

## Step-by-Step Setup

### 1. Install Dependencies (2 min)

```bash
npm install
```

### 2. Set Up Database (3 min)

1. Go to [neon.tech](https://neon.tech) and create a free account
2. Create a new project called "saas-analytics"
3. Copy your connection string (looks like `postgresql://user:pass@ep-xyz.us-east-2.aws.neon.tech/neondb`)
4. In Neon's SQL Editor, copy and paste the entire contents of `db/schema.sql`
5. Click "Run" to create all tables

### 3. Set Up Authentication (3 min)

1. Go to [clerk.com](https://clerk.com) and create a free account
2. Create a new application called "SaaS Analytics"
3. Enable "Email" authentication (under User & Authentication → Email, Phone, Username)
4. Go to "API Keys" in the sidebar
5. Copy your **Publishable Key** and **Secret Key**

### 4. Configure Environment Variables (1 min)

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in:

```env
# From Neon
DATABASE_URL="postgresql://..."

# From Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."

# Leave these as default
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/dashboard"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/onboarding"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
MAX_FILE_SIZE_BYTES="10485760"
ANOMALY_DETECTION_SENSITIVITY="3"
```

### 5. Run Development Server (30 sec)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## First Time Usage

### Creating Your First Organization

1. Click "Get Started" on the landing page
2. Sign up with your email
3. You'll be redirected to the onboarding page
4. Create your first organization (e.g., "My Company")
5. Click "Create Organization"

### Uploading Sample Data

1. On the dashboard, look for the "Upload CSV Data" section
2. Use the provided `sample-data.csv` file in the project root
3. Click "Upload & Process"
4. Wait a few seconds for processing

### Viewing Analytics

1. Select an event type from the dropdown (e.g., "page_view" or "purchase")
2. Choose a time period (Last 24 hours, 7 days, 30 days)
3. Select aggregation period (Hourly or Daily)
4. View the time-series chart

### Detecting Anomalies

1. With an event type selected, click "Detect Anomalies"
2. The system will analyze the data for spikes, drops, and outliers
3. Detected anomalies appear below the chart with severity levels
4. Click "Acknowledge" to mark an anomaly as reviewed

## Testing with Sample Data

The included `sample-data.csv` contains:
- 25 events over several hours
- 3 event types: `page_view`, `signup`, `purchase`
- Metric values representing counts or amounts
- Dimensions: `user_id`, `region`

This data will demonstrate:
- Time-series visualization
- Event type filtering
- Basic anomaly detection

## Common Issues

### "Database connection failed"
- Check your DATABASE_URL is correct
- Make sure your Neon database is active
- Verify the schema was applied (check if tables exist in Neon dashboard)

### "Authentication error"
- Verify both Clerk keys are correct
- Make sure you're using the correct keys (Publishable starts with `pk_`, Secret starts with `sk_`)
- Check that you saved `.env.local` properly

### "Module not found" errors
- Run `npm install` again
- Delete `node_modules` and `.next` folders, then run `npm install`

### CSV upload fails
- Check file is valid CSV format
- Ensure file is under 10MB
- Must have headers in first row
- At least one column should contain numbers or dates

## Project Structure Quick Reference

```
saas/
├── app/                    # Next.js pages
│   ├── page.tsx           # Landing page
│   ├── dashboard/         # Main dashboard
│   ├── sign-in/           # Auth pages
│   └── onboarding/        # New org setup
├── actions/               # Server Actions (backend logic)
├── lib/
│   ├── db/               # Database queries
│   ├── csv/              # CSV parsing
│   ├── analytics/        # Analytics + anomaly detection
│   └── auth/             # Auth helpers
├── components/           # React components
└── db/schema.sql        # Database schema
```

## Next Steps

1. ✅ Explore the dashboard
2. ✅ Upload your own CSV data
3. ✅ Experiment with different time ranges
4. ✅ Try anomaly detection
5. ✅ Invite team members (add to tenant_members table)
6. ✅ Review the code to understand the architecture
7. ✅ Deploy to Vercel (see README.md)

## Need Help?

- Check the main [README.md](README.md) for detailed documentation
- Review the database schema in [db/schema.sql](db/schema.sql)
- Look at code comments in the source files
- Check Neon dashboard for database queries
- Review Clerk dashboard for auth logs

## Production Deployment

Once you're ready to deploy:

1. Push code to GitHub
2. Connect to Vercel
3. Add the same environment variables
4. Deploy
5. Update Clerk authorized domains

See the full deployment guide in [README.md](README.md#deployment)

---

**You're all set!** Start exploring the analytics platform. 🚀
