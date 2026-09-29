-- ==============================================================================
-- AYUSHI REAL ESTATE - POSTGRESQL SCHEMA FOR NEON DATABASE
-- Enhanced with Lead Scoring, Stages, Admin/Agent Auth, and Source Tracking
-- ==============================================================================

-- Drop tables in reverse order of foreign key dependencies
DROP TABLE IF EXISTS notes CASCADE;
DROP TABLE IF EXISTS viewings CASCADE;
DROP TABLE IF EXISTS completed_sales CASCADE;
DROP TABLE IF EXISTS buyer_leads CASCADE;
DROP TABLE IF EXISTS properties CASCADE;
DROP TABLE IF EXISTS offplan_projects CASCADE;
DROP TABLE IF EXISTS developers CASCADE;
DROP TABLE IF EXISTS staff_logins CASCADE;

-- 1. DEVELOPERS
CREATE TABLE developers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  tagline VARCHAR(255),
  description TEXT,
  headquarters VARCHAR(100),
  established_year INT,
  delivered_projects INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. STAFF LOGINS (AGENTS & ADMIN)
CREATE TABLE staff_logins (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(100) NOT NULL DEFAULT 'admin123',
  role VARCHAR(100) DEFAULT 'Senior Private Client Advisor',
  is_admin BOOLEAN DEFAULT FALSE,
  phone VARCHAR(50),
  avatar_initials VARCHAR(10),
  rera_license VARCHAR(50),
  monthly_target_aed NUMERIC(15, 2) DEFAULT 50000000,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. OFF-PLAN PROJECTS
CREATE TABLE offplan_projects (
  id SERIAL PRIMARY KEY,
  developer_id INT REFERENCES developers(id) ON DELETE SET NULL,
  developer_name VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  community VARCHAR(100) NOT NULL,
  starting_price_aed NUMERIC(15, 2) NOT NULL,
  handover_date VARCHAR(50) NOT NULL,
  payment_plan VARCHAR(255) NOT NULL,
  down_payment_pct INT DEFAULT 10,
  construction_pct INT DEFAULT 50,
  handover_pct INT DEFAULT 40,
  property_types VARCHAR(255),
  image_url TEXT,
  description TEXT,
  projected_roi VARCHAR(50),
  amenities JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. PROPERTIES (READY RESIDENCES)
CREATE TABLE properties (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  reference_no VARCHAR(50) UNIQUE NOT NULL,
  property_type VARCHAR(100) NOT NULL, -- Villa, Penthouse, Apartment, Townhouse
  status VARCHAR(50) DEFAULT 'Ready', -- 'Ready', 'Under Offer', 'Sold'
  community VARCHAR(100) NOT NULL, -- Dubai Marina, Downtown, Palm Jumeirah, Business Bay, Dubai Hills, JVC
  sub_community VARCHAR(100),
  price_aed NUMERIC(15, 2) NOT NULL,
  bedrooms INT NOT NULL,
  bathrooms INT NOT NULL,
  built_up_area_sqft NUMERIC(10, 2) NOT NULL,
  plot_size_sqft NUMERIC(10, 2) DEFAULT 0,
  parking_spaces INT DEFAULT 2,
  view_type VARCHAR(255),
  service_charges_per_sqft NUMERIC(5, 2),
  image_url TEXT,
  gallery_images JSONB,
  description TEXT,
  amenities JSONB,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. BUYER LEADS
CREATE TABLE buyer_leads (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150),
  phone VARCHAR(50) NOT NULL,
  lead_type VARCHAR(100) DEFAULT 'General Inquiry',
  preferred_community VARCHAR(100),
  property_id INT REFERENCES properties(id) ON DELETE SET NULL,
  offplan_id INT REFERENCES offplan_projects(id) ON DELETE SET NULL,
  budget_bracket_aed VARCHAR(100),
  deal_value_aed NUMERIC(15, 2) DEFAULT 0,
  score INT DEFAULT 50, -- 0 to 100
  temperature VARCHAR(20) DEFAULT 'WARM', -- 'HOT', 'WARM', 'COLD'
  stage VARCHAR(50) DEFAULT 'New', -- 'New', 'Contacted', 'Viewing', 'Offer', 'Won', 'Lost'
  source_form VARCHAR(150) DEFAULT 'Website Form',
  cash_buyer BOOLEAN DEFAULT FALSE,
  timeline VARCHAR(100) DEFAULT 'Within 1-3 Months',
  message TEXT,
  assigned_agent_id INT REFERENCES staff_logins(id) ON DELETE SET NULL,
  source_page VARCHAR(100),
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. VIEWINGS
CREATE TABLE viewings (
  id SERIAL PRIMARY KEY,
  property_id INT REFERENCES properties(id) ON DELETE CASCADE,
  lead_id INT REFERENCES buyer_leads(id) ON DELETE CASCADE,
  agent_id INT REFERENCES staff_logins(id) ON DELETE SET NULL,
  viewing_date DATE NOT NULL,
  viewing_time VARCHAR(50) NOT NULL,
  viewing_mode VARCHAR(100) DEFAULT 'Private In-Person',
  status VARCHAR(50) DEFAULT 'Confirmed', -- 'Requested', 'Confirmed', 'Completed', 'Cancelled'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. COMPLETED SALES
CREATE TABLE completed_sales (
  id SERIAL PRIMARY KEY,
  property_id INT REFERENCES properties(id) ON DELETE SET NULL,
  property_title VARCHAR(255) NOT NULL,
  community VARCHAR(100) NOT NULL,
  buyer_name VARCHAR(150) NOT NULL,
  lead_id INT REFERENCES buyer_leads(id) ON DELETE SET NULL,
  agent_id INT REFERENCES staff_logins(id) ON DELETE SET NULL,
  sale_price_aed NUMERIC(15, 2) NOT NULL,
  commission_aed NUMERIC(15, 2) NOT NULL, -- 2% commission
  dld_fee_paid_aed NUMERIC(15, 2) NOT NULL, -- 4% DLD
  sale_date DATE NOT NULL,
  transaction_reference VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. NOTES
CREATE TABLE notes (
  id SERIAL PRIMARY KEY,
  lead_id INT REFERENCES buyer_leads(id) ON DELETE CASCADE,
  staff_id INT REFERENCES staff_logins(id) ON DELETE SET NULL,
  author_name VARCHAR(150),
  note_type VARCHAR(100) DEFAULT 'Internal Note',
  note_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indices for rapid querying
CREATE INDEX idx_properties_community ON properties(community);
CREATE INDEX idx_properties_type ON properties(property_type);
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_leads_stage ON buyer_leads(stage);
CREATE INDEX idx_leads_temperature ON buyer_leads(temperature);
CREATE INDEX idx_leads_score ON buyer_leads(score);
CREATE INDEX idx_leads_agent ON buyer_leads(assigned_agent_id);
CREATE INDEX idx_leads_last_activity ON buyer_leads(last_activity_at);
