-- ================================================================
-- Multi-Tenant SaaS Analytics Dashboard - PostgreSQL Schema
-- ================================================================
-- Architecture: Tenant-isolated data using tenant_id with indexes
-- Security: Foreign keys, constraints, and RLS-ready structure
-- ================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- TENANTS TABLE
-- ================================================================
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  settings JSONB DEFAULT '{}'::JSONB,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted'))
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status);

-- ================================================================
-- USERS TABLE
-- ================================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_clerk_id ON users(clerk_user_id);
CREATE INDEX idx_users_email ON users(email);

-- ================================================================
-- TENANT MEMBERS (User-Tenant Relationship with Roles)
-- ================================================================
CREATE TABLE tenant_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  invited_by UUID REFERENCES users(id),
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX idx_tenant_members_tenant ON tenant_members(tenant_id);
CREATE INDEX idx_tenant_members_user ON tenant_members(user_id);
CREATE INDEX idx_tenant_members_role ON tenant_members(role);

-- ================================================================
-- UPLOADED FILES
-- ================================================================
CREATE TABLE uploaded_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  filename VARCHAR(255) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  row_count INTEGER DEFAULT 0,
  columns JSONB NOT NULL,
  schema_inferred JSONB,
  upload_status VARCHAR(50) DEFAULT 'processing' CHECK (upload_status IN ('processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_uploaded_files_tenant ON uploaded_files(tenant_id, created_at DESC);
CREATE INDEX idx_uploaded_files_status ON uploaded_files(upload_status);
CREATE INDEX idx_uploaded_files_user ON uploaded_files(uploaded_by);

-- ================================================================
-- ANALYTICS EVENTS (Raw Event Data)
-- ================================================================
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  file_id UUID REFERENCES uploaded_files(id) ON DELETE SET NULL,
  event_type VARCHAR(100) NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  metric_value NUMERIC(20, 4),
  dimensions JSONB DEFAULT '{}'::JSONB,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_analytics_events_tenant ON analytics_events(tenant_id, event_timestamp DESC);
CREATE INDEX idx_analytics_events_type ON analytics_events(tenant_id, event_type, event_timestamp DESC);
CREATE INDEX idx_analytics_events_timestamp ON analytics_events(event_timestamp);
CREATE INDEX idx_analytics_events_file ON analytics_events(file_id);
CREATE INDEX idx_analytics_events_dimensions ON analytics_events USING GIN(dimensions);

-- ================================================================
-- AGGREGATED METRICS (Pre-computed aggregations for performance)
-- ================================================================
CREATE TABLE aggregated_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  aggregation_period VARCHAR(20) NOT NULL CHECK (aggregation_period IN ('hour', 'day', 'week', 'month')),
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  count_events INTEGER NOT NULL DEFAULT 0,
  sum_value NUMERIC(20, 4),
  avg_value NUMERIC(20, 4),
  min_value NUMERIC(20, 4),
  max_value NUMERIC(20, 4),
  stddev_value NUMERIC(20, 4),
  dimensions JSONB DEFAULT '{}'::JSONB,
  computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, event_type, aggregation_period, period_start, dimensions)
);

CREATE INDEX idx_aggregated_metrics_tenant ON aggregated_metrics(tenant_id, period_start DESC);
CREATE INDEX idx_aggregated_metrics_type ON aggregated_metrics(tenant_id, event_type, aggregation_period, period_start DESC);
CREATE INDEX idx_aggregated_metrics_period ON aggregated_metrics(aggregation_period, period_start);

-- ================================================================
-- ANOMALY RESULTS (Detected Anomalies)
-- ================================================================
CREATE TABLE anomaly_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL,
  anomaly_type VARCHAR(50) NOT NULL CHECK (anomaly_type IN ('spike', 'drop', 'outlier')),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  metric_value NUMERIC(20, 4) NOT NULL,
  expected_value NUMERIC(20, 4),
  deviation_percentage NUMERIC(10, 2),
  threshold_used NUMERIC(20, 4),
  metadata JSONB DEFAULT '{}'::JSONB,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_anomaly_results_tenant ON anomaly_results(tenant_id, detected_at DESC);
CREATE INDEX idx_anomaly_results_type ON anomaly_results(tenant_id, event_type, detected_at DESC);
CREATE INDEX idx_anomaly_results_severity ON anomaly_results(severity, acknowledged);
CREATE INDEX idx_anomaly_results_unack ON anomaly_results(tenant_id, acknowledged) WHERE acknowledged = FALSE;

-- ================================================================
-- FUNCTIONS & TRIGGERS
-- ================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- ROW LEVEL SECURITY (RLS) SETUP
-- ================================================================
-- Enable RLS on all tenant-scoped tables

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE aggregated_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies will be created based on application context
-- Example policy (to be customized based on auth strategy):
-- CREATE POLICY tenant_isolation ON analytics_events
--   FOR ALL
--   USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ================================================================
-- SEED DATA (Optional - for development)
-- ================================================================

-- Insert a demo tenant
-- INSERT INTO tenants (name, slug) VALUES ('Demo Organization', 'demo-org');

-- ================================================================
-- NOTES
-- ================================================================
-- 1. All tenant-scoped tables include tenant_id with proper indexing
-- 2. Foreign keys ensure referential integrity
-- 3. Timestamps indexed for time-range queries
-- 4. JSONB fields for flexible schema evolution
-- 5. Constraints prevent invalid data states
-- 6. RLS enabled for security at database level
-- 7. Indexes optimized for common query patterns
-- ================================================================
