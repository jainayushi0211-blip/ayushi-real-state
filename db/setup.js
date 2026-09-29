/**
 * NEON DATABASE SETUP & SEEDING SCRIPT
 * Run with: npm run db:setup (or node db/setup.js)
 * Reads DATABASE_URL from .env and populates Neon with the luxury real estate data.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';
import {
  developers,
  offplanProjects,
  readyProperties,
  staffLogins,
  sampleLeads,
  sampleViewings,
  sampleSales,
  sampleNotes
} from './sampleData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;

async function setupDatabase() {
  console.log('----------------------------------------------------');
  console.log('🏛️  AYUSHI REAL ESTATE - NEON DATABASE INITIALIZER');
  console.log('----------------------------------------------------');

  if (!connectionString || connectionString.includes('your_user:your_password') || connectionString.includes('ep-sample-pooler')) {
    console.error('⚠️  No valid Neon DATABASE_URL found in .env!');
    console.error('👉 Please paste your Neon connection string in .env:');
    console.error('   DATABASE_URL=postgresql://[user]:[password]@[endpoint].neon.tech/neondb?sslmode=require');
    console.error('----------------------------------------------------');
    console.log('ℹ️  The Ayushi Real Estate application will still run smoothly');
    console.log('   using the in-memory fallback layer with all 16 properties,');
    console.log('   6 off-plan projects, 5 developers, and 40 sample leads!');
    process.exit(0);
  }

  const { Pool } = pg;
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to Neon PostgreSQL...');
    const client = await pool.connect();
    console.log('✅ Connected successfully to Neon!');

    // 1. Run Schema
    console.log('📜 Executing schema.sql (creating tables)...');
    const schemaSql = fs.readFileSync(path.resolve(__dirname, 'schema.sql'), 'utf-8');
    await client.query(schemaSql);
    console.log('✅ Tables created: developers, staff_logins, offplan_projects, properties, buyer_leads, viewings, completed_sales, notes.');

    // 2. Seed Developers (5)
    console.log(`🌱 Seeding ${developers.length} Developers...`);
    for (const d of developers) {
      await client.query(
        `INSERT INTO developers (id, name, tagline, description, headquarters, established_year, delivered_projects)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [d.id, d.name, d.tagline, d.description, d.headquarters, d.established_year, d.delivered_projects]
      );
    }

    // 3. Seed Staff Logins (3)
    console.log(`🌱 Seeding ${staffLogins.length} Staff Logins (Agents)...`);
    for (const s of staffLogins) {
      await client.query(
        `INSERT INTO staff_logins (id, name, email, role, phone, avatar_initials, rera_license)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [s.id, s.name, s.email, s.role, s.phone, s.avatar_initials, s.rera_license]
      );
    }

    // 4. Seed Off-Plan Projects (6)
    console.log(`🌱 Seeding ${offplanProjects.length} Off-Plan Projects...`);
    for (const op of offplanProjects) {
      await client.query(
        `INSERT INTO offplan_projects (id, developer_id, developer_name, name, slug, community, starting_price_aed, handover_date, payment_plan, down_payment_pct, construction_pct, handover_pct, property_types, image_url, description, projected_roi, amenities)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [op.id, op.developer_id, op.developer_name, op.name, op.slug, op.community, op.starting_price_aed, op.handover_date, op.payment_plan, op.down_payment_pct, op.construction_pct, op.handover_pct, op.property_types, op.image_url, op.description, op.projected_roi, JSON.stringify(op.amenities)]
      );
    }

    // 5. Seed Properties (16)
    console.log(`🌱 Seeding ${readyProperties.length} Ready Properties across Dubai Marina, Downtown, Palm Jumeirah, Business Bay, Dubai Hills, and JVC...`);
    for (const p of readyProperties) {
      await client.query(
        `INSERT INTO properties (id, title, slug, reference_no, property_type, status, community, sub_community, price_aed, bedrooms, bathrooms, built_up_area_sqft, plot_size_sqft, parking_spaces, view_type, service_charges_per_sqft, image_url, description, amenities, is_featured)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
         ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title`,
        [p.id, p.title, p.slug, p.reference_no, p.property_type, p.status, p.community, p.sub_community, p.price_aed, p.bedrooms, p.bathrooms, p.built_up_area_sqft, p.plot_size_sqft, p.parking_spaces, p.view_type, p.service_charges_per_sqft, p.image_url, p.description, JSON.stringify(p.amenities), p.is_featured]
      );
    }

    // 6. Seed Buyer Leads (40)
    console.log(`🌱 Seeding ${sampleLeads.length} Buyer Leads...`);
    for (const l of sampleLeads) {
      await client.query(
        `INSERT INTO buyer_leads (id, full_name, email, phone, lead_type, preferred_community, property_id, offplan_id, budget_bracket_aed, message, status, assigned_agent_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name`,
        [l.id, l.full_name, l.email, l.phone, l.lead_type, l.preferred_community, l.property_id || null, l.offplan_id || null, l.budget_bracket_aed, l.message, l.status, l.assigned_agent_id]
      );
    }

    // 7. Seed Viewings (10)
    console.log(`🌱 Seeding ${sampleViewings.length} Viewings...`);
    for (const v of sampleViewings) {
      await client.query(
        `INSERT INTO viewings (id, property_id, lead_id, agent_id, viewing_date, viewing_time, viewing_mode, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
        [v.id, v.property_id, v.lead_id, v.agent_id, v.viewing_date, v.viewing_time, v.viewing_mode, v.status, v.notes]
      );
    }

    // 8. Seed Completed Sales (5)
    console.log(`🌱 Seeding ${sampleSales.length} Completed Sales...`);
    for (const cs of sampleSales) {
      await client.query(
        `INSERT INTO completed_sales (id, property_id, property_title, community, buyer_name, agent_id, sale_price_aed, commission_aed, dld_fee_paid_aed, sale_date, transaction_reference)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET transaction_reference = EXCLUDED.transaction_reference`,
        [cs.id, cs.property_id, cs.property_title, cs.community, cs.buyer_name, cs.agent_id, cs.sale_price_aed, cs.commission_aed, cs.dld_fee_paid_aed, cs.sale_date, cs.transaction_reference]
      );
    }

    // 9. Seed Notes
    console.log(`🌱 Seeding ${sampleNotes.length} Client Notes...`);
    for (const n of sampleNotes) {
      await client.query(
        `INSERT INTO notes (id, lead_id, staff_id, note_type, note_text)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET note_text = EXCLUDED.note_text`,
        [n.id, n.lead_id, n.staff_id, n.note_type, n.note_text]
      );
    }

    // Reset sequences to prevent key collisions on new inserts
    await client.query(`SELECT setval('developers_id_seq', (SELECT MAX(id) FROM developers))`);
    await client.query(`SELECT setval('staff_logins_id_seq', (SELECT MAX(id) FROM staff_logins))`);
    await client.query(`SELECT setval('offplan_projects_id_seq', (SELECT MAX(id) FROM offplan_projects))`);
    await client.query(`SELECT setval('properties_id_seq', (SELECT MAX(id) FROM properties))`);
    await client.query(`SELECT setval('buyer_leads_id_seq', (SELECT MAX(id) FROM buyer_leads))`);
    await client.query(`SELECT setval('viewings_id_seq', (SELECT MAX(id) FROM viewings))`);
    await client.query(`SELECT setval('completed_sales_id_seq', (SELECT MAX(id) FROM completed_sales))`);
    await client.query(`SELECT setval('notes_id_seq', (SELECT MAX(id) FROM notes))`);

    client.release();
    console.log('----------------------------------------------------');
    console.log('🎉 Neon PostgreSQL database successfully configured & seeded!');
    console.log('----------------------------------------------------');
  } catch (err) {
    console.error('❌ Database setup error:', err);
  } finally {
    await pool.end();
  }
}

setupDatabase();
