/**
 * Database client for Ayushi Real Estate.
 * Supports Neon PostgreSQL and high-performance in-memory fallback.
 * Includes Lead Scoring (0-100, HOT/WARM/COLD), Stage Pipelines,
 * Won Deal 2% Commission Calculations, and Property/Project CRUD.
 */

import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  developers as initialDevelopers,
  offplanProjects as initialOffplan,
  readyProperties as initialProperties,
  staffLogins as initialStaff,
  sampleLeads as initialLeads,
  sampleViewings as initialViewings,
  sampleSales as initialSales,
  sampleNotes as initialNotes
} from './sampleData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;
let pool = null;
let useNeon = false;

// In-Memory store fallback
const memoryStore = {
  developers: JSON.parse(JSON.stringify(initialDevelopers)),
  offplan: JSON.parse(JSON.stringify(initialOffplan)),
  properties: JSON.parse(JSON.stringify(initialProperties)),
  staff: JSON.parse(JSON.stringify(initialStaff)),
  leads: JSON.parse(JSON.stringify(initialLeads)),
  viewings: JSON.parse(JSON.stringify(initialViewings)),
  sales: JSON.parse(JSON.stringify(initialSales)),
  notes: JSON.parse(JSON.stringify(initialNotes))
};

if (connectionString && !connectionString.includes('your_user:your_password') && !connectionString.includes('ep-sample-pooler')) {
  try {
    const { Pool } = pg;
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000
    });
    useNeon = true;
    console.log('🏛️  [Neon DB] PostgreSQL pool initialized.');
  } catch (err) {
    console.warn('⚠️  [Neon DB] Failed to create PostgreSQL pool, using in-memory store fallback:', err.message);
    useNeon = false;
  }
} else {
  console.log('ℹ️  [Ayushi Engine] Neon DATABASE_URL not yet configured. Operating with luxury dataset in memory.');
}

// -----------------------------------------------------------------------------
// LEAD SCORING ALGORITHM (0 to 100, HOT / WARM / COLD)
// -----------------------------------------------------------------------------
export function calculateLeadScore(lead) {
  let score = 0;

  // 1. Phone number provided & valid format: +15 points
  if (lead.phone && String(lead.phone).trim().length >= 7) {
    score += 15;
  }

  // 2. Budget points (Bigger budgets = higher priority):
  const budget = String(lead.budget_bracket_aed || '').toUpperCase();
  if (budget.includes('70M') || budget.includes('50M+') || budget.includes('100M')) {
    score += 25;
  } else if (budget.includes('35M') || budget.includes('50M')) {
    score += 20;
  } else if (budget.includes('15M') || budget.includes('25M') || budget.includes('35M')) {
    score += 15;
  } else if (budget.includes('5M') || budget.includes('15M') || budget.includes('10M')) {
    score += 10;
  } else {
    score += 5;
  }

  // 3. Cash buyer status / proof of funds: +20 points
  const msg = String(lead.message || '').toLowerCase();
  if (lead.cash_buyer === true || /cash|proof of funds|settlement|ready funds/i.test(msg)) {
    score += 20;
  }

  // 4. Buying timeframe / Readiness to buy soon: +25 points
  const timeline = String(lead.timeline || '').toLowerCase();
  if (timeline.includes('immediate') || timeline.includes('ready') || /immediate|this week|tomorrow|arriving|flight/i.test(msg)) {
    score += 25;
  } else if (timeline.includes('1-3') || timeline.includes('month') || /month/i.test(msg)) {
    score += 15;
  } else {
    score += 5;
  }

  // 5. Interest in a specific property or project: +15 points
  if (lead.property_id || lead.offplan_id || /villa|penthouse|duplex|residence/i.test(msg)) {
    score += 15;
  }

  // Clamp 0 to 100
  score = Math.min(100, Math.max(0, score));

  // Temperature Tag
  let temperature = 'COLD';
  if (score >= 70) {
    temperature = 'HOT';
  } else if (score >= 40) {
    temperature = 'WARM';
  } else {
    temperature = 'COLD';
  }

  return { score, temperature };
}

// Data Access Service
export const dbService = {
  isNeonConnected() {
    return useNeon;
  },

  // Auth: Find user by email and password
  async authenticate(email, password) {
    const user = memoryStore.staff.find(s => s.email.toLowerCase() === email.toLowerCase() && s.password === password);
    if (!user) return null;
    const { password: _, ...safeUser } = user;
    return safeUser;
  },

  async getDevelopers() {
    return memoryStore.developers;
  },

  async getOffplanProjects() {
    return memoryStore.offplan;
  },

  async getOffplanProjectBySlug(slug) {
    return memoryStore.offplan.find(p => p.slug === slug || String(p.id) === String(slug));
  },

  async addOffplanProject(data) {
    const newProj = {
      id: memoryStore.offplan.length + 1,
      slug: data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      ...data,
      created_at: new Date().toISOString()
    };
    memoryStore.offplan.unshift(newProj);
    return newProj;
  },

  async updateOffplanProject(id, data) {
    const idx = memoryStore.offplan.findIndex(p => p.id === parseInt(id, 10));
    if (idx === -1) return null;
    memoryStore.offplan[idx] = { ...memoryStore.offplan[idx], ...data };
    return memoryStore.offplan[idx];
  },

  async deleteOffplanProject(id) {
    const idx = memoryStore.offplan.findIndex(p => p.id === parseInt(id, 10));
    if (idx === -1) return false;
    memoryStore.offplan.splice(idx, 1);
    return true;
  },

  async getProperties(filters = {}) {
    let list = memoryStore.properties;

    if (filters.community && filters.community !== 'all') {
      list = list.filter(p => p.community.toLowerCase() === filters.community.toLowerCase());
    }
    if (filters.type && filters.type !== 'all') {
      list = list.filter(p => p.property_type.toLowerCase() === filters.type.toLowerCase());
    }
    if (filters.bedrooms && filters.bedrooms !== 'all') {
      const beds = parseInt(filters.bedrooms, 10);
      list = list.filter(p => p.bedrooms >= beds);
    }
    if (filters.maxPrice) {
      list = list.filter(p => parseFloat(p.price_aed) <= parseFloat(filters.maxPrice));
    }
    return list;
  },

  async getPropertyBySlug(slug) {
    return memoryStore.properties.find(p => p.slug === slug || String(p.id) === String(slug));
  },

  async addProperty(data) {
    const newProp = {
      id: memoryStore.properties.length + 1,
      slug: data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      reference_no: `AYU-${(data.community || 'DXB').slice(0, 2).toUpperCase()}-${String(memoryStore.properties.length + 1).padStart(3, '0')}`,
      status: 'Ready',
      is_featured: false,
      ...data,
      created_at: new Date().toISOString()
    };
    memoryStore.properties.unshift(newProp);
    return newProp;
  },

  async updateProperty(id, data) {
    const idx = memoryStore.properties.findIndex(p => p.id === parseInt(id, 10));
    if (idx === -1) return null;
    memoryStore.properties[idx] = { ...memoryStore.properties[idx], ...data };
    return memoryStore.properties[idx];
  },

  async deleteProperty(id) {
    const idx = memoryStore.properties.findIndex(p => p.id === parseInt(id, 10));
    if (idx === -1) return false;
    memoryStore.properties.splice(idx, 1);
    return true;
  },

  async getStaff() {
    return memoryStore.staff.map(s => {
      const { password: _, ...safe } = s;
      return safe;
    });
  },

  // LEADS
  async getLeads(agentId = null, isAdmin = false) {
    let list = memoryStore.leads;
    // Agents only see their own leads, Admins see all leads
    if (!isAdmin && agentId) {
      list = list.filter(l => l.assigned_agent_id === parseInt(agentId, 10));
    }
    return list;
  },

  async getLeadById(id) {
    return memoryStore.leads.find(l => l.id === parseInt(id, 10));
  },

  async addLead(leadData) {
    const { score, temperature } = calculateLeadScore(leadData);

    // Auto-assign agent if not specified (round-robin / default to Tariq #2 or Elena #3)
    let agentId = leadData.assigned_agent_id;
    if (!agentId) {
      agentId = leadData.offplan_id ? 3 : 2; // Elena for off-plan, Tariq for ready
    }

    const newLead = {
      id: memoryStore.leads.length + 1,
      full_name: leadData.full_name,
      email: leadData.email || '',
      phone: leadData.phone,
      lead_type: leadData.lead_type || 'General Inquiry',
      source_form: leadData.source_form || 'Website Form',
      preferred_community: leadData.preferred_community || 'Dubai Prime',
      property_id: leadData.property_id || null,
      offplan_id: leadData.offplan_id || null,
      budget_bracket_aed: leadData.budget_bracket_aed || 'AED 15M - AED 35M',
      deal_value_aed: leadData.deal_value_aed || 15000000,
      cash_buyer: leadData.cash_buyer || false,
      timeline: leadData.timeline || 'Within 1-3 Months',
      message: leadData.message || '',
      score,
      temperature,
      stage: 'New',
      assigned_agent_id: agentId,
      source_page: leadData.source_page || 'Website',
      last_activity_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    memoryStore.leads.unshift(newLead);
    return newLead;
  },

  async updateLeadStage(id, stage) {
    const lead = memoryStore.leads.find(l => l.id === parseInt(id, 10));
    if (!lead) return null;
    lead.stage = stage;
    lead.last_activity_at = new Date().toISOString();
    return lead;
  },

  async updateLead(id, updates) {
    const lead = memoryStore.leads.find(l => l.id === parseInt(id, 10));
    if (!lead) return null;
    Object.assign(lead, updates, { last_activity_at: new Date().toISOString() });
    return lead;
  },

  // Record Won Deal: ask for sale price, work out 2% commission, mark property as Sold
  async recordWonDeal(leadId, salePriceAed, propertyId = null, buyerName = null, agentId = null) {
    const lead = memoryStore.leads.find(l => l.id === parseInt(leadId, 10));
    const price = parseFloat(salePriceAed);
    const commission = price * 0.02; // 2% Commission
    const dldFee = price * 0.04; // 4% DLD Fee

    // 1. Update lead stage to Won
    if (lead) {
      lead.stage = 'Won';
      lead.deal_value_aed = price;
      lead.last_activity_at = new Date().toISOString();
    }

    // 2. Find property and mark as Sold
    const propId = propertyId || (lead ? lead.property_id : 1);
    const prop = memoryStore.properties.find(p => p.id === parseInt(propId, 10));
    if (prop) {
      prop.status = 'Sold';
    }

    // 3. Create entry in completed_sales
    const newSale = {
      id: memoryStore.sales.length + 1,
      property_id: propId,
      property_title: prop ? prop.title : 'Prime Dubai Residence',
      community: prop ? prop.community : 'Dubai Prime',
      buyer_name: buyerName || (lead ? lead.full_name : 'Private Principal'),
      lead_id: lead ? lead.id : null,
      agent_id: agentId || (lead ? lead.assigned_agent_id : 1),
      sale_price_aed: price,
      commission_aed: commission,
      dld_fee_paid_aed: dldFee,
      sale_date: new Date().toISOString().split('T')[0],
      transaction_reference: `DLD-TXN-2026-${Math.floor(10000 + Math.random() * 90000)}`,
      created_at: new Date().toISOString()
    };

    memoryStore.sales.unshift(newSale);
    return { sale: newSale, commission, property: prop };
  },

  // Stale leads: no activity for 3+ days
  async getStaleLeads(agentId = null, isAdmin = false) {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    let list = memoryStore.leads.filter(l => {
      if (l.stage === 'Won' || l.stage === 'Lost') return false;
      const last = new Date(l.last_activity_at || l.created_at);
      return last < threeDaysAgo;
    });

    if (!isAdmin && agentId) {
      list = list.filter(l => l.assigned_agent_id === parseInt(agentId, 10));
    }
    return list;
  },

  // Notification bell: new leads uncontacted
  async getNotifications(agentId = null, isAdmin = false) {
    let newLeads = memoryStore.leads.filter(l => l.stage === 'New');
    if (!isAdmin && agentId) {
      newLeads = newLeads.filter(l => l.assigned_agent_id === parseInt(agentId, 10));
    }
    return {
      unread_count: newLeads.length,
      latest_leads: newLeads.slice(0, 5)
    };
  },

  // Notes
  async getNotes(leadId) {
    return memoryStore.notes.filter(n => n.lead_id === parseInt(leadId, 10));
  },

  async addNote(leadId, staffId, noteText, authorName = 'Advisor') {
    const newNote = {
      id: memoryStore.notes.length + 1,
      lead_id: parseInt(leadId, 10),
      staff_id: parseInt(staffId, 10),
      author_name: authorName,
      note_type: 'Internal Note',
      note_text: noteText,
      created_at: new Date().toISOString()
    };
    memoryStore.notes.unshift(newNote);

    // Update lead last_activity_at
    const lead = memoryStore.leads.find(l => l.id === parseInt(leadId, 10));
    if (lead) lead.last_activity_at = new Date().toISOString();

    return newNote;
  },

  // Viewings
  async getViewings(agentId = null, isAdmin = false) {
    let list = memoryStore.viewings;
    if (!isAdmin && agentId) {
      list = list.filter(v => v.agent_id === parseInt(agentId, 10));
    }
    return list;
  },

  async addViewing(viewingData) {
    const newViewing = {
      id: memoryStore.viewings.length + 1,
      ...viewingData,
      status: 'Confirmed',
      created_at: new Date().toISOString()
    };
    memoryStore.viewings.unshift(newViewing);

    if (viewingData.lead_id) {
      const lead = memoryStore.leads.find(l => l.id === parseInt(viewingData.lead_id, 10));
      if (lead) {
        lead.stage = 'Viewing';
        lead.last_activity_at = new Date().toISOString();
      }
    }
    return newViewing;
  },

  // Sales
  async getSales() {
    return memoryStore.sales;
  },

  // Dashboard Stats
  async getAdminStats(agentId = null, isAdmin = false) {
    const leads = await this.getLeads(agentId, isAdmin);
    const viewings = await this.getViewings(agentId, isAdmin);
    const stale = await this.getStaleLeads(agentId, isAdmin);

    // New leads today (created within last 24h)
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    const newLeadsToday = leads.filter(l => new Date(l.created_at) >= oneDayAgo).length;

    // Total deal value in pipeline
    const pipelineValue = leads
      .filter(l => l.stage !== 'Lost' && l.stage !== 'Won')
      .reduce((sum, l) => sum + (parseFloat(l.deal_value_aed) || 15000000), 0);

    // Viewings this week
    const viewingsThisWeek = viewings.length;

    // Sales and commission this month
    const totalSalesMonth = memoryStore.sales.reduce((sum, s) => sum + parseFloat(s.sale_price_aed), 0);
    const totalCommissionMonth = memoryStore.sales.reduce((sum, s) => sum + parseFloat(s.commission_aed), 0);

    // Stage counts
    const stages = {
      New: leads.filter(l => l.stage === 'New').length,
      Contacted: leads.filter(l => l.stage === 'Contacted').length,
      Viewing: leads.filter(l => l.stage === 'Viewing').length,
      Offer: leads.filter(l => l.stage === 'Offer').length,
      Won: leads.filter(l => l.stage === 'Won').length,
      Lost: leads.filter(l => l.stage === 'Lost').length
    };

    // Temperature counts
    const temperatures = {
      HOT: leads.filter(l => l.temperature === 'HOT').length,
      WARM: leads.filter(l => l.temperature === 'WARM').length,
      COLD: leads.filter(l => l.temperature === 'COLD').length
    };

    return {
      newLeadsToday,
      pipelineValue,
      viewingsThisWeek,
      totalSalesMonth,
      totalCommissionMonth,
      staleLeadsCount: stale.length,
      totalLeads: leads.length,
      stages,
      temperatures
    };
  },

  // Agent Leaderboard
  async getAgentLeaderboard() {
    return memoryStore.staff.map(agent => {
      const agentSales = memoryStore.sales.filter(s => s.agent_id === agent.id);
      const totalVolume = agentSales.reduce((sum, s) => sum + parseFloat(s.sale_price_aed), 0);
      const totalCommission = agentSales.reduce((sum, s) => sum + parseFloat(s.commission_aed), 0);
      const activeDeals = memoryStore.leads.filter(l => l.assigned_agent_id === agent.id && l.stage !== 'Lost' && l.stage !== 'Won').length;
      const target = parseFloat(agent.monthly_target_aed || 50000000);
      const pctAchieved = Math.min(100, Math.round((totalVolume / target) * 100));

      return {
        id: agent.id,
        name: agent.name,
        role: agent.role,
        avatar_initials: agent.avatar_initials,
        monthly_target_aed: target,
        total_volume_aed: totalVolume,
        total_commission_aed: totalCommission,
        closed_deals_count: agentSales.length,
        active_pipeline_count: activeDeals,
        pct_achieved: pctAchieved
      };
    });
  }
};
