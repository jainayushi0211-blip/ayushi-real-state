/**
 * AYUSHI REAL ESTATE - BACKEND API SERVER
 * Enhanced with:
 * - Anti-flood rate limiting & anti-spam honeypot
 * - Lead scoring & source form attribution
 * - Staff authentication (Admin & Agents)
 * - Role-based lead access (Agents only see their own leads)
 * - Pipeline Kanban updates, Won deal 2% commission & property Sold marker
 * - Notification bell polling & stale leads tracking
 * - Full CRUD for properties & projects
 * - Strictly NO EMAIL SENDING
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { dbService } from './db/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());

// -----------------------------------------------------------------------------
// ROBOTS & SEARCH ENGINE PRIVACY
// Public pages are discoverable, while API and admin portal are strictly hidden
// -----------------------------------------------------------------------------
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/admin')) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  }
  next();
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.sendFile(path.resolve(__dirname, 'robots.txt'));
});

app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml');
  res.sendFile(path.resolve(__dirname, 'sitemap.xml'));
});

// -----------------------------------------------------------------------------
// RATE LIMITING & ANTI-FLOOD MIDDLEWARE
// "Stop people from sending too many forms quickly."
// -----------------------------------------------------------------------------
const submissionHistory = new Map(); // ip -> [timestamps]

function rateLimitCheck(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'client';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxSubmissions = 4; // max 4 submissions per minute
  const minIntervalMs = 4000; // minimum 4 seconds between requests

  let timestamps = submissionHistory.get(ip) || [];
  timestamps = timestamps.filter(t => now - t < windowMs);

  if (timestamps.length > 0) {
    const lastTime = timestamps[timestamps.length - 1];
    if (now - lastTime < minIntervalMs) {
      return res.status(429).json({
        success: false,
        error: 'Please wait a moment before submitting another inquiry.'
      });
    }
  }

  if (timestamps.length >= maxSubmissions) {
    return res.status(429).json({
      success: false,
      error: 'Too many submissions. Please wait 60 seconds before trying again.'
    });
  }

  timestamps.push(now);
  submissionHistory.set(ip, timestamps);
  next();
}

// Anti-Spam Middleware
function antiSpamCheck(req, res, next) {
  const { honeypot, phone, full_name, email } = req.body;

  // 1. Honeypot check
  if (honeypot && String(honeypot).trim() !== '') {
    return res.status(200).json({
      success: true,
      message: 'Thank you. A Jay Real Estate advisor will contact you within 24 hours.'
    });
  }

  // 2. Required fields
  if (!phone || String(phone).trim().length < 6) {
    return res.status(400).json({
      success: false,
      error: 'Please provide a valid phone number or WhatsApp contact.'
    });
  }

  if (full_name && String(full_name).trim().length < 2) {
    return res.status(400).json({
      success: false,
      error: 'Please provide your full name.'
    });
  }

  // 3. Email regex if provided
  if (email && email.trim() !== '') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid email address.'
      });
    }
  }

  next();
}

// -----------------------------------------------------------------------------
// PUBLIC API ROUTES
// -----------------------------------------------------------------------------

// Health
app.get('/api/health', async (req, res) => {
  const isNeon = dbService.isNeonConnected();
  res.json({
    status: 'online',
    neon_connected: isNeon,
    timestamp: new Date().toISOString(),
    message: isNeon
      ? 'Connected to Neon PostgreSQL database.'
      : 'Running on in-memory high performance luxury real estate cache. Paste your Neon URL in .env and run "npm run db:setup" to link Neon.'
  });
});

// Developers
app.get('/api/developers', async (req, res) => {
  try {
    const developers = await dbService.getDevelopers();
    res.json({ success: true, count: developers.length, data: developers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Off-Plan Projects
app.get('/api/offplan', async (req, res) => {
  try {
    const projects = await dbService.getOffplanProjects();
    res.json({ success: true, count: projects.length, data: projects });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/offplan/:slug', async (req, res) => {
  try {
    const project = await dbService.getOffplanProjectBySlug(req.params.slug);
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
    res.json({ success: true, data: project });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Properties
app.get('/api/properties', async (req, res) => {
  try {
    const { community, type, bedrooms, maxPrice } = req.query;
    const properties = await dbService.getProperties({ community, type, bedrooms, maxPrice });
    res.json({ success: true, count: properties.length, data: properties });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/properties/:slug', async (req, res) => {
  try {
    const property = await dbService.getPropertyBySlug(req.params.slug);
    if (!property) return res.status(404).json({ success: false, error: 'Property not found' });
    res.json({ success: true, data: property });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Staff (public agents listing)
app.get('/api/staff', async (req, res) => {
  try {
    const staff = await dbService.getStaff();
    res.json({ success: true, count: staff.length, data: staff });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// SUBMIT LEAD (VIP Register, Brochure, Valuation, Inquiries)
// Remembers source form, applies anti-spam and rate limiting, scores lead, returns exact requested thank you message!
app.post('/api/leads', rateLimitCheck, antiSpamCheck, async (req, res) => {
  try {
    const newLead = await dbService.addLead(req.body);
    res.json({
      success: true,
      message: 'Thank you. A Jay Real Estate advisor will contact you within 24 hours.',
      lead: newLead
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// BOOK A VIEWING
app.post('/api/viewings', rateLimitCheck, antiSpamCheck, async (req, res) => {
  try {
    const { full_name, email, phone, property_id, viewing_date, viewing_time, viewing_mode, notes, source_form } = req.body;

    const lead = await dbService.addLead({
      full_name,
      email,
      phone,
      lead_type: 'Viewing Request',
      source_form: source_form || 'Viewing Reservation Form',
      property_id,
      timeline: 'Immediate / Ready',
      message: `Requested ${viewing_mode || 'Private In-Person'} viewing on ${viewing_date} at ${viewing_time}. Notes: ${notes || 'None'}`
    });

    const viewing = await dbService.addViewing({
      property_id,
      lead_id: lead.id,
      agent_id: lead.assigned_agent_id || 2,
      viewing_date,
      viewing_time,
      viewing_mode,
      notes
    });

    res.json({
      success: true,
      message: 'Thank you. A Jay Real Estate advisor will contact you within 24 hours.',
      viewing,
      lead
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// AUTHENTICATION ROUTES (STAFF & AGENTS)
// -----------------------------------------------------------------------------
app.post(['/api/auth/login', '/api/staff/login'], async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }

    const user = await dbService.authenticate(email, password);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials. Please verify your email and password.' });
    }

    res.json({
      success: true,
      message: `Welcome back, ${user.name}`,
      user,
      token: `ayu_token_${user.id}_${Date.now()}`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// ADMIN & AGENT PORTAL ROUTES
// Role-based: Agents only see their own leads; Admins see all leads
// -----------------------------------------------------------------------------

// Dashboard Stats
app.get('/api/admin/stats', async (req, res) => {
  try {
    const agentId = req.query.agent_id ? parseInt(req.query.agent_id, 10) : null;
    const isAdmin = req.query.is_admin === 'true';
    const stats = await dbService.getAdminStats(agentId, isAdmin);
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Notification Bell: counts new uncontacted leads + latest list (Refreshes every minute)
app.get('/api/admin/notifications', async (req, res) => {
  try {
    const agentId = req.query.agent_id ? parseInt(req.query.agent_id, 10) : null;
    const isAdmin = req.query.is_admin === 'true';
    const notifications = await dbService.getNotifications(agentId, isAdmin);
    res.json({ success: true, data: notifications });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Leads List with Filters & Role-Based Access
app.get('/api/admin/leads', async (req, res) => {
  try {
    const agentId = req.query.agent_id ? parseInt(req.query.agent_id, 10) : null;
    const isAdmin = req.query.is_admin === 'true';
    let leads = await dbService.getLeads(agentId, isAdmin);

    // Optional query filters
    if (req.query.stage && req.query.stage !== 'all') {
      leads = leads.filter(l => l.stage.toLowerCase() === req.query.stage.toLowerCase());
    }
    if (req.query.temperature && req.query.temperature !== 'all') {
      leads = leads.filter(l => l.temperature.toLowerCase() === req.query.temperature.toLowerCase());
    }
    if (req.query.search) {
      const s = req.query.search.toLowerCase();
      leads = leads.filter(l =>
        l.full_name.toLowerCase().includes(s) ||
        (l.email && l.email.toLowerCase().includes(s)) ||
        l.phone.includes(s) ||
        (l.preferred_community && l.preferred_community.toLowerCase().includes(s))
      );
    }

    res.json({ success: true, count: leads.length, data: leads });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Single Lead Details
app.get('/api/admin/leads/:id', async (req, res) => {
  try {
    const lead = await dbService.getLeadById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });
    const notes = await dbService.getNotes(lead.id);
    res.json({ success: true, data: { ...lead, notes } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Lead Stage (for Drag-and-Drop Kanban Board)
app.put('/api/admin/leads/:id/stage', async (req, res) => {
  try {
    const { stage } = req.body;
    if (!stage) return res.status(400).json({ success: false, error: 'Stage required' });
    const updated = await dbService.updateLeadStage(req.params.id, stage);
    if (!updated) return res.status(404).json({ success: false, error: 'Lead not found' });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Lead Details & Assign Agent
app.put('/api/admin/leads/:id', async (req, res) => {
  try {
    const updated = await dbService.updateLead(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, error: 'Lead not found' });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Mark Lead as "Won": asks for sale price, works out 2% commission, marks property as Sold
app.post('/api/admin/leads/:id/won', async (req, res) => {
  try {
    const { sale_price_aed, property_id, buyer_name, agent_id } = req.body;
    if (!sale_price_aed || parseFloat(sale_price_aed) <= 0) {
      return res.status(400).json({ success: false, error: 'Valid sale price in AED is required' });
    }

    const result = await dbService.recordWonDeal(
      req.params.id,
      sale_price_aed,
      property_id,
      buyer_name,
      agent_id
    );

    res.json({
      success: true,
      message: `Deal closed! 2% commission of AED ${Math.round(result.commission).toLocaleString()} recorded. Property marked as SOLD.`,
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Notes on Lead
app.get('/api/admin/leads/:id/notes', async (req, res) => {
  try {
    const notes = await dbService.getNotes(req.params.id);
    res.json({ success: true, data: notes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/leads/:id/notes', async (req, res) => {
  try {
    const { staff_id, note_text, author_name } = req.body;
    if (!note_text) return res.status(400).json({ success: false, error: 'Note text required' });
    const note = await dbService.addNote(req.params.id, staff_id || 1, note_text, author_name);
    res.json({ success: true, data: note });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Stale Leads (no activity for 3+ days)
app.get('/api/admin/stale-leads', async (req, res) => {
  try {
    const agentId = req.query.agent_id ? parseInt(req.query.agent_id, 10) : null;
    const isAdmin = req.query.is_admin === 'true';
    const stale = await dbService.getStaleLeads(agentId, isAdmin);
    res.json({ success: true, count: stale.length, data: stale });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Agent Leaderboard
app.get('/api/admin/leaderboard', async (req, res) => {
  try {
    const leaderboard = await dbService.getAgentLeaderboard();
    res.json({ success: true, data: leaderboard });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Viewings
app.get('/api/admin/viewings', async (req, res) => {
  try {
    const agentId = req.query.agent_id ? parseInt(req.query.agent_id, 10) : null;
    const isAdmin = req.query.is_admin === 'true';
    const viewings = await dbService.getViewings(agentId, isAdmin);
    res.json({ success: true, count: viewings.length, data: viewings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// PROPERTY & PROJECT MANAGEMENT (CRUD)
// "Let me add, edit, and remove properties and projects"
// -----------------------------------------------------------------------------

// Add Property
app.post('/api/properties', async (req, res) => {
  try {
    const newProp = await dbService.addProperty(req.body);
    res.json({ success: true, data: newProp, message: 'Property created successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Edit Property
app.put('/api/properties/:id', async (req, res) => {
  try {
    const updated = await dbService.updateProperty(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, error: 'Property not found' });
    res.json({ success: true, data: updated, message: 'Property updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete Property
app.delete('/api/properties/:id', async (req, res) => {
  try {
    const ok = await dbService.deleteProperty(req.params.id);
    if (!ok) return res.status(404).json({ success: false, error: 'Property not found' });
    res.json({ success: true, message: 'Property removed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add Off-Plan Project
app.post('/api/offplan', async (req, res) => {
  try {
    const newProj = await dbService.addOffplanProject(req.body);
    res.json({ success: true, data: newProj, message: 'Off-plan project created successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Edit Off-Plan Project
app.put('/api/offplan/:id', async (req, res) => {
  try {
    const updated = await dbService.updateOffplanProject(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, error: 'Project not found' });
    res.json({ success: true, data: updated, message: 'Project updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete Off-Plan Project
app.delete('/api/offplan/:id', async (req, res) => {
  try {
    const ok = await dbService.deleteOffplanProject(req.params.id);
    if (!ok) return res.status(404).json({ success: false, error: 'Project not found' });
    res.json({ success: true, message: 'Project removed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Static assets
app.use(express.static(__dirname));

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`✨ Ayushi Real Estate API server running at http://localhost:${PORT}`);
  });
}

export default app;
