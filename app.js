/**
 * AYUSHI REAL ESTATE - APPLICATION CONTROLLER & CLIENT ROUTER
 * Features:
 * - Dynamic Hash Routing (#/, #/properties, #/property/:slug, #/offplan, #/offplan/:slug, #/calculator, #/sell, #/about, #/contact)
 * - REST API integration with Neon PostgreSQL database (with memory fallback)
 * - Anti-spam protected forms & instant luxury thank-you messages (STRICTLY NO EMAIL SENDING)
 * - Dubai Mortgage & Upfront Costs Calculator (AED, UAE Central Bank Regulations)
 * - Floating WhatsApp & Call Me Back actions
 */

import {
  readyProperties as localProperties,
  offplanProjects as localOffplan,
  developers as localDevelopers,
  staffLogins as localStaff
} from './db/sampleData.js';

// Application State Cache
const AppState = {
  properties: [...localProperties],
  offplan: [...localOffplan],
  developers: [...localDevelopers],
  staff: [...localStaff],
  isNeonLive: false
};

// Number Formatters
const formatAED = (num) => 'AED ' + Math.round(num || 0).toLocaleString('en-US');

// Exact wording required by Prompt:
const EXACT_THANK_YOU = 'Thank you. A Jay Real Estate advisor will contact you within 24 hours.';

// Anti-flood rate limiting for form submissions:
let lastPublicSubmitTime = 0;
function isClientRateLimited() {
  const now = Date.now();
  if (now - lastPublicSubmitTime < 4000) {
    showToast('Please wait a moment before sending another inquiry.');
    return true;
  }
  lastPublicSubmitTime = now;
  return false;
}

// Staff / Agent Session Management
function getStaffSession() {
  try {
    const raw = localStorage.getItem('ayushi_staff_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setStaffSession(user) {
  localStorage.setItem('ayushi_staff_user', JSON.stringify(user));
}

function clearStaffSession() {
  localStorage.removeItem('ayushi_staff_user');
}

// Preloader Dismissal
function dismissPreloader() {
  const preloader = document.getElementById('luxury-preloader');
  if (preloader && !preloader.classList.contains('preloader-hidden')) {
    preloader.classList.add('preloader-hidden');
    setTimeout(() => {
      preloader.style.display = 'none';
    }, 700);
  }
}

// Route Transition Progress Bar
function startRouteProgress() {
  const bar = document.getElementById('route-loading-bar');
  if (bar) {
    bar.classList.remove('finished');
    bar.classList.add('active');
  }
}

function finishRouteProgress() {
  const bar = document.getElementById('route-loading-bar');
  if (bar) {
    bar.classList.add('finished');
    setTimeout(() => {
      bar.classList.remove('active', 'finished');
    }, 350);
  }
}

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  initTopNavbar();
  initMobileMenu();
  initFloatingActions();
  initGlobalModals();
  initAdminModals();

  // Load live data from API (Neon or fallback)
  try {
    await fetchInitialData();
  } catch (err) {
    console.warn('Initial data load warning:', err.message);
  } finally {
    setTimeout(dismissPreloader, 350);
  }

  // Safety fallback: guaranteed preloader dismissal
  setTimeout(dismissPreloader, 1500);

  // Initialize Routing
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
});

/* ==========================================================================
   1. DATA SYNC (REST API)
   ========================================================================== */
async function fetchInitialData() {
  try {
    const healthRes = await fetch('/api/health');
    if (healthRes.ok) {
      const healthData = await healthRes.json();
      AppState.isNeonLive = healthData.neon_connected;
    }

    const [propsRes, offplanRes, devsRes, staffRes] = await Promise.all([
      fetch('/api/properties'),
      fetch('/api/offplan'),
      fetch('/api/developers'),
      fetch('/api/staff')
    ]);

    if (propsRes.ok) {
      const p = await propsRes.json();
      if (p.data && p.data.length) AppState.properties = p.data;
    }
    if (offplanRes.ok) {
      const o = await offplanRes.json();
      if (o.data && o.data.length) AppState.offplan = o.data;
    }
    if (devsRes.ok) {
      const d = await devsRes.json();
      if (d.data && d.data.length) AppState.developers = d.data;
    }
    if (staffRes.ok) {
      const s = await staffRes.json();
      if (s.data && s.data.length) AppState.staff = s.data;
    }
  } catch (err) {
    console.warn('Operating on local luxury real estate cache:', err.message);
  }
}

/* ==========================================================================
   2. TOP NAVBAR & SCROLL BEHAVIOR
   ========================================================================== */
function initTopNavbar() {
  const header = document.getElementById('main-header');
  if (!header) return;

  const updateHeaderState = () => {
    const isHome = window.location.hash === '' || window.location.hash === '#/' || window.location.hash === '#';
    const isAdmin = window.location.hash.startsWith('#/admin');
    const scrollPos = window.scrollY || window.pageYOffset;

    const footer = document.querySelector('.footer');
    const floating = document.querySelector('.floating-actions-container');

    if (isAdmin) {
      header.style.display = 'none';
      if (footer) footer.style.display = 'none';
      if (floating) floating.style.display = 'none';
      return;
    } else {
      header.style.display = '';
      if (footer) footer.style.display = '';
      if (floating) floating.style.display = '';
    }

    if (!isHome) {
      header.classList.add('header-opaque');
      header.classList.remove('header-transparent');
    } else {
      header.classList.remove('header-opaque');
      if (scrollPos > 60) {
        header.classList.add('header-scrolled');
        header.classList.remove('header-transparent');
      } else {
        header.classList.remove('header-scrolled');
        header.classList.add('header-transparent');
      }
    }
  };

  window.addEventListener('scroll', updateHeaderState, { passive: true });
  window.addEventListener('hashchange', updateHeaderState);
  updateHeaderState();
}

/* ==========================================================================
   3. MOBILE FULL-SCREEN DRAWER MENU
   ========================================================================== */
function initMobileMenu() {
  const toggleBtn = document.getElementById('mobile-menu-btn');
  const closeBtn = document.getElementById('mobile-menu-close');
  const overlay = document.getElementById('mobile-menu-overlay');
  const mobileLinks = document.querySelectorAll('.mobile-link');
  const mobileRegBtn = document.getElementById('mobile-register-btn');

  if (!toggleBtn || !overlay) return;

  const openMenu = () => {
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    toggleBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  };

  const closeMenu = () => {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    toggleBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };

  toggleBtn.addEventListener('click', openMenu);
  if (closeBtn) closeBtn.addEventListener('click', closeMenu);

  mobileLinks.forEach(link => {
    link.addEventListener('click', () => closeMenu());
  });

  if (mobileRegBtn) {
    mobileRegBtn.addEventListener('click', () => {
      closeMenu();
      openRegisterModal();
    });
  }
}

/* ==========================================================================
   4. FLOATING ACTIONS & CALL ME BACK POPOVER
   ========================================================================== */
function initFloatingActions() {
  const callbackBtn = document.getElementById('floating-callback-btn');
  const callbackModal = document.getElementById('callback-modal');
  const closeBtn = document.getElementById('callback-close-btn');
  const successCloseBtn = document.getElementById('callback-success-close');
  const callbackForm = document.getElementById('callback-form');
  const callbackSuccess = document.getElementById('callback-success');

  if (callbackBtn && callbackModal) {
    callbackBtn.addEventListener('click', () => {
      callbackModal.classList.add('open');
      callbackModal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      if (callbackForm) callbackForm.style.display = 'block';
      if (callbackSuccess) callbackSuccess.style.display = 'none';
    });

    const closeCallback = () => {
      callbackModal.classList.remove('open');
      callbackModal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    };

    if (closeBtn) closeBtn.addEventListener('click', closeCallback);
    if (successCloseBtn) successCloseBtn.addEventListener('click', closeCallback);

    callbackModal.addEventListener('click', (e) => {
      if (e.target === callbackModal) closeCallback();
    });

    if (callbackForm) {
      callbackForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isClientRateLimited()) return;

        const honeypot = callbackForm.querySelector('.honeypot-field')?.value;
        const name = document.getElementById('cb-name')?.value || 'Client';
        const phone = document.getElementById('cb-phone')?.value;
        const time = document.getElementById('cb-time')?.value;

        // Anti-spam check
        if (honeypot) {
          callbackForm.style.display = 'none';
          if (callbackSuccess) {
            const confText = callbackSuccess.querySelector('.conf-text');
            if (confText) confText.textContent = EXACT_THANK_YOU;
            callbackSuccess.style.display = 'block';
          }
          showToast(EXACT_THANK_YOU);
          return;
        }

        // Post lead to API
        try {
          const res = await fetch('/api/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              full_name: name,
              phone,
              lead_type: 'Callback Request',
              source_form: 'Floating Call Me Back Form',
              message: `Requested callback at ${time}`,
              timeline: 'Immediate / Ready'
            })
          });

          if (res.status === 429) {
            const err = await res.json().catch(() => ({}));
            showToast(err.error || 'Please wait a moment before sending another request.');
            return;
          }
        } catch (err) {
          console.warn('Saved callback locally');
        }

        callbackForm.style.display = 'none';
        if (callbackSuccess) {
          const confText = callbackSuccess.querySelector('.conf-text');
          if (confText) confText.textContent = EXACT_THANK_YOU;
          callbackSuccess.style.display = 'block';
        }
        showToast(EXACT_THANK_YOU);
      });
    }
  }
}

/* ==========================================================================
   5. GLOBAL MODALS (REGISTER INTEREST)
   ========================================================================== */
function initGlobalModals() {
  const regModal = document.getElementById('register-modal');
  const closeBtn = document.getElementById('modal-close-btn');
  const successCloseBtn = document.getElementById('success-close-btn');
  const navRegisterBtn = document.getElementById('nav-register-btn');
  const regForm = document.getElementById('register-form');
  const regSuccess = document.getElementById('register-success');

  window.openRegisterModal = (prefillContext = '') => {
    if (!regModal) return;
    regModal.classList.add('open');
    regModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    if (regForm) regForm.style.display = 'block';
    if (regSuccess) regSuccess.style.display = 'none';

    if (prefillContext) {
      const sub = regModal.querySelector('.modal-sub');
      if (sub) sub.textContent = `Express private interest in: ${prefillContext}`;
    }
  };

  const closeRegModal = () => {
    if (!regModal) return;
    regModal.classList.remove('open');
    regModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  if (closeBtn) closeBtn.addEventListener('click', closeRegModal);
  if (successCloseBtn) successCloseBtn.addEventListener('click', closeRegModal);

  if (regModal) {
    regModal.addEventListener('click', (e) => {
      if (e.target === regModal) closeRegModal();
    });
  }

  if (navRegisterBtn) {
    navRegisterBtn.addEventListener('click', () => openRegisterModal());
  }

  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isClientRateLimited()) return;

      const honeypot = regForm.querySelector('.honeypot-field')?.value;
      const name = document.getElementById('reg-name')?.value || 'Client';
      const phone = document.getElementById('reg-phone')?.value;
      const community = document.getElementById('reg-community')?.value;
      const budget = document.getElementById('reg-budget')?.value;

      if (honeypot) {
        regForm.style.display = 'none';
        if (regSuccess) {
          const confText = regSuccess.querySelector('.conf-text');
          if (confText) confText.textContent = EXACT_THANK_YOU;
          regSuccess.style.display = 'block';
        }
        showToast(EXACT_THANK_YOU);
        return;
      }

      try {
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: name,
            phone,
            preferred_community: community,
            budget_bracket_aed: budget,
            lead_type: 'VIP Register Interest',
            source_form: 'VIP Access Registration Modal'
          })
        });

        if (res.status === 429) {
          const err = await res.json().catch(() => ({}));
          showToast(err.error || 'Please wait a moment before sending another request.');
          return;
        }
      } catch (err) {
        console.warn('Saved lead locally');
      }

      regForm.style.display = 'none';
      if (regSuccess) {
        const confText = regSuccess.querySelector('.conf-text');
        if (confText) confText.textContent = EXACT_THANK_YOU;
        regSuccess.style.display = 'block';
      }
      showToast(EXACT_THANK_YOU);
    });
  }
}

/* ==========================================================================
   LUXURY 404 & ERROR HANDLING PAGES
   ========================================================================== */
function render404Page(container, context = 'page', identifier = '') {
  let title = 'Residence Not Located';
  let badge = 'PORTFOLIO NOTICE • 404';
  let description = 'The luxury residence, off-plan collection, or private advisory page you requested is not currently listed on our open market, or may have concluded a private transaction.';
  
  if (context === 'residence') {
    title = 'Residence Not Found';
    badge = 'PRIVATE LISTING NOT FOUND';
    description = `The requested property listing "${identifier || ''}" is unavailable or has been archived from our active Dubai sales portfolio.`;
  } else if (context === 'project') {
    title = 'Off-Plan Project Not Found';
    badge = 'DEVELOPMENT RECORD UNAVAILABLE';
    description = `The off-plan architectural project "${identifier || ''}" could not be located in our verified developer register.`;
  }

  container.innerHTML = `
    <section class="luxury-error-page">
      <div class="luxury-error-card">
        <span class="error-code-badge">${badge}</span>
        <h1 class="error-title">${title}</h1>
        <p class="error-description">${description}</p>
        <div class="error-actions-group">
          <a href="#/properties" class="btn btn-gold">Browse Ready Residences</a>
          <a href="#/offplan" class="btn btn-outline">Explore Off-Plan</a>
          <a href="#/" class="btn btn-outline">Return to Home</a>
        </div>
      </div>
    </section>
  `;
}

function renderErrorPage(container, err) {
  console.error('Portal Runtime Notice:', err);
  container.innerHTML = `
    <section class="luxury-error-page">
      <div class="luxury-error-card">
        <span class="error-code-badge">ADVISORY NOTICE • 500</span>
        <h1 class="error-title">Concierge Service Interruption</h1>
        <p class="error-description">
          We encountered a temporary technical delay while loading this luxury portfolio view. Our private desk is available to assist you directly.
        </p>
        <div class="error-actions-group">
          <button type="button" class="btn btn-gold" onclick="window.location.reload()">Reload Application</button>
          <a href="#/" class="btn btn-outline">Return to Home</a>
          <a href="#/contact" class="btn btn-outline">Contact Private Desk</a>
        </div>
      </div>
    </section>
  `;
}

/* ==========================================================================
   6. CLIENT ROUTER (#/, #/properties, #/property/:slug, #/offplan, etc.)
   ========================================================================== */
function handleRoute() {
  startRouteProgress();
  try {
    const hash = window.location.hash || '#/';
    const appView = document.getElementById('app-view');
    if (!appView) return;

    window.scrollTo({ top: 0, behavior: 'instant' });

    // Update active state in nav
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });

    // Update dynamic robots meta tag and page title for SEO & Admin privacy
    const metaRobots = document.getElementById('meta-robots');
    if (hash.startsWith('#/admin')) {
      if (metaRobots) {
        metaRobots.setAttribute('content', 'noindex, nofollow, noarchive, nosnippet');
      }
      document.title = 'Ayushi Real Estate | Private Brokerage Management Portal';
    } else {
      if (metaRobots) {
        metaRobots.setAttribute('content', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
      }
    }

    if (hash.startsWith('#/admin/login')) {
      renderAdminLoginPage(appView);
    } else if (hash.startsWith('#/admin')) {
      const session = getStaffSession();
      if (!session) {
        window.location.hash = '#/admin/login';
        return;
      }
      renderAdminPortalPage(appView, session);
    } else if (hash === '#/' || hash === '' || hash === '#') {
      document.title = 'Ayushi Real Estate | Luxury Property Sales in Dubai';
      document.querySelector('.nav-link[data-route="home"]')?.classList.add('active');
      renderHomePage(appView);
    } else if (hash === '#/properties' || hash.startsWith('#/properties?')) {
      document.title = 'Ready Luxury Residences in Dubai | Ayushi Real Estate';
      document.querySelector('.nav-link[data-route="properties"]')?.classList.add('active');
      renderPropertiesPage(appView);
    } else if (hash.startsWith('#/property/')) {
      document.querySelector('.nav-link[data-route="properties"]')?.classList.add('active');
      const slug = hash.replace('#/property/', '');
      renderSinglePropertyPage(appView, slug);
    } else if (hash.startsWith('#/offplan/')) {
      document.querySelector('.nav-link[data-route="offplan"]')?.classList.add('active');
      const slug = hash.replace('#/offplan/', '');
      renderSingleOffplanPage(appView, slug);
    } else if (hash === '#/offplan' || hash.startsWith('#/offplan?')) {
      document.title = 'Exclusive Dubai Off-Plan Projects | Ayushi Real Estate';
      document.querySelector('.nav-link[data-route="offplan"]')?.classList.add('active');
      renderOffplanPage(appView);
    } else if (hash.startsWith('#/calculator')) {
      document.title = 'Dubai Mortgage & Upfront Fee Calculator | Ayushi Real Estate';
      document.querySelector('.nav-link[data-route="calculator"]')?.classList.add('active');
      renderCalculatorPage(appView);
    } else if (hash.startsWith('#/sell')) {
      document.title = 'Sell Your Luxury Dubai Residence | Ayushi Real Estate Concierge';
      document.querySelector('.nav-link[data-route="sell"]')?.classList.add('active');
      renderSellPage(appView);
    } else if (hash.startsWith('#/about')) {
      document.title = 'About Ayushi Real Estate | Dubai Private Property Advisory';
      document.querySelector('.nav-link[data-route="about"]')?.classList.add('active');
      renderAboutPage(appView);
    } else if (hash.startsWith('#/contact')) {
      document.title = 'Contact Ayushi Real Estate | Private Advisory DIFC';
      document.querySelector('.nav-link[data-route="contact"]')?.classList.add('active');
      renderContactPage(appView);
    } else {
      document.title = '404 - Residence Not Located | Ayushi Real Estate';
      render404Page(appView, 'page', hash);
    }
  } catch (err) {
    renderErrorPage(document.getElementById('app-view'), err);
  } finally {
    finishRouteProgress();
  }
}

/* ==========================================================================
   PAGE 1: HOME PAGE
   Search Bar, Featured Properties, Featured Off-Plan, Why Invest in Dubai, Communities, Register Interest Form
   ========================================================================== */
function renderHomePage(container) {
  const featuredReady = AppState.properties.filter(p => p.is_featured).slice(0, 4);
  const featuredOffplan = AppState.offplan.slice(0, 3);

  container.innerHTML = `
    <!-- HERO SECTION -->
    <section class="hero-section" id="hero">
      <div class="hero-bg-container">
        <img src="assets/images/hero-dubai-skyline.jpg" alt="Dubai Skyline at Twilight" class="hero-bg-image" />
        <div class="hero-overlay"></div>
      </div>

      <div class="hero-content">
        <span class="hero-gold-tag">DUBAI'S PRIVATE REAL ESTATE PORTFOLIO</span>
        <h1 class="hero-title">Live Where Luxury Meets the Skyline</h1>
        <p class="hero-description">
          Exclusive homes and off-plan investments across Dubai's most sought-after communities
        </p>

        <div class="hero-actions">
          <a href="#/properties" class="btn btn-outline-white">Explore Properties</a>
          <button type="button" class="btn btn-gold" id="home-hero-reg-btn">Register Interest</button>
        </div>

        <!-- SEARCH BAR COMPONENT -->
        <div class="hero-search-box">
          <form id="hero-search-form" class="search-form-grid">
            <div class="search-field">
              <label for="search-community" class="search-label">COMMUNITY</label>
              <select id="search-community" class="search-select">
                <option value="all">All Communities</option>
                <option value="Palm Jumeirah">Palm Jumeirah</option>
                <option value="Downtown">Downtown Dubai</option>
                <option value="Dubai Hills">Dubai Hills Estate</option>
                <option value="Dubai Marina">Dubai Marina</option>
                <option value="Business Bay">Business Bay</option>
                <option value="JVC">Jumeirah Village Circle (JVC)</option>
              </select>
            </div>

            <div class="search-field">
              <label for="search-type" class="search-label">PROPERTY TYPE</label>
              <select id="search-type" class="search-select">
                <option value="all">All Types</option>
                <option value="Villa">Waterfront & Golf Villas</option>
                <option value="Penthouse">Sky Penthouses</option>
                <option value="Apartment">Luxury Apartments</option>
                <option value="Townhouse">Townhouses</option>
              </select>
            </div>

            <div class="search-field">
              <label for="search-price" class="search-label">MAX PRICE (AED)</label>
              <select id="search-price" class="search-select">
                <option value="all">Any Price</option>
                <option value="5000000">Up to AED 5,000,000</option>
                <option value="15000000">Up to AED 15,000,000</option>
                <option value="35000000">Up to AED 35,000,000</option>
                <option value="80000000">Up to AED 80,000,000</option>
              </select>
            </div>

            <div class="search-field">
              <label for="search-status" class="search-label">STATUS</label>
              <select id="search-status" class="search-select">
                <option value="all">Ready & Off-Plan</option>
                <option value="ready">Ready to Move</option>
                <option value="offplan">Off-Plan Projects</option>
              </select>
            </div>

            <button type="submit" class="btn btn-charcoal btn-search-submit">Search</button>
          </form>
        </div>

      </div>
    </section>

    <!-- SECTION: FEATURED PROPERTIES -->
    <section class="section properties-section">
      <div class="container">
        <div class="section-header text-center">
          <span class="section-tag">DISCOVER</span>
          <h2 class="section-heading">Featured Residences</h2>
          <p class="section-subheading">Turnkey architectural statements delivered for immediate occupancy</p>
        </div>

        <div class="property-grid">
          ${featuredReady.map(renderPropertyCardHtml).join('')}
        </div>

        <div style="text-align: center; margin-top: 3.5rem;">
          <a href="#/properties" class="btn btn-charcoal">View Full Ready Portfolio (16 Homes)</a>
        </div>
      </div>
    </section>

    <!-- SECTION: FEATURED OFF-PLAN PROJECTS -->
    <section class="section offplan-section" style="background-color: var(--color-offwhite);">
      <div class="container">
        <div class="section-header text-center">
          <span class="section-tag">OFF-PLAN PROJECTS</span>
          <h2 class="section-heading">Flagship Developments</h2>
          <p class="section-subheading">Exclusive developer launches with milestone construction payment plans</p>
        </div>

        <div class="offplan-projects-grid">
          ${featuredOffplan.map(renderOffplanCardHtml).join('')}
        </div>

        <div style="text-align: center; margin-top: 3.5rem;">
          <a href="#/offplan" class="btn btn-gold">Explore All Off-Plan Projects</a>
        </div>
      </div>
    </section>

    <!-- SECTION: WHY INVEST IN DUBAI -->
    <section class="section why-invest-section">
      <div class="container">
        <div class="section-header text-center">
          <span class="section-tag">DUBAI ADVANTAGE</span>
          <h2 class="section-heading">Why Invest in Dubai</h2>
          <p class="section-subheading">A global economic capital offering unmatched fiscal security, high capital appreciation, and residency privileges</p>
        </div>

        <div class="invest-perks-grid">
          <div class="invest-perk-card">
            <span class="invest-perk-index">01</span>
            <div class="invest-perk-line"></div>
            <h3 class="invest-perk-title">100% Tax-Free Returns</h3>
            <p class="invest-perk-desc">0% personal income tax, 0% capital gains tax, and 0% property inheritance tax ensure maximum compounding wealth preservation.</p>
          </div>

          <div class="invest-perk-card">
            <span class="invest-perk-index">02</span>
            <div class="invest-perk-line"></div>
            <h3 class="invest-perk-title">World-Leading Rental Yields</h3>
            <p class="invest-perk-desc">Gross rental returns average 7% to 10% in prime districts, consistently outperforming London, New York, Hong Kong, and Singapore.</p>
          </div>

          <div class="invest-perk-card">
            <span class="invest-perk-index">03</span>
            <div class="invest-perk-line"></div>
            <h3 class="invest-perk-title">10-Year Golden Visa</h3>
            <p class="invest-perk-desc">Real estate investments exceeding AED 2,000,000 grant renewable 10-year UAE Golden Residency for you, your spouse, children, and domestic team.</p>
          </div>

          <div class="invest-perk-card">
            <span class="invest-perk-index">04</span>
            <div class="invest-perk-line"></div>
            <h3 class="invest-perk-title">Pegged Currency Security</h3>
            <p class="invest-perk-desc">The UAE Dirham (AED) has been officially pegged to the US Dollar since 1997, protecting international wealth against foreign exchange volatility.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION: POPULAR COMMUNITIES -->
    <section class="section communities-section">
      <div class="container">
        <div class="section-header text-center">
          <span class="section-tag">PRIME LOCALES</span>
          <h2 class="section-heading">Popular Communities</h2>
          <p class="section-subheading">Explore Dubai's most prestigious postal codes</p>
        </div>

        <div class="communities-grid">
          <a href="#/properties?community=Palm+Jumeirah" class="community-card">
            <img src="assets/images/palm-waterfront-villa.jpg" alt="Palm Jumeirah" class="community-card-bg">
            <div class="community-card-overlay"></div>
            <div class="community-card-content">
              <h3 class="community-name">Palm Jumeirah</h3>
              <p class="community-meta">Waterfront Villas & Beach Penthouses</p>
            </div>
          </a>

          <a href="#/properties?community=Downtown" class="community-card">
            <img src="assets/images/downtown-penthouse.jpg" alt="Downtown Dubai" class="community-card-bg">
            <div class="community-card-overlay"></div>
            <div class="community-card-content">
              <h3 class="community-name">Downtown Dubai</h3>
              <p class="community-meta">Burj Khalifa & Opera District</p>
            </div>
          </a>

          <a href="#/properties?community=Dubai+Hills" class="community-card">
            <img src="assets/images/elysian-mansion.jpg" alt="Dubai Hills Estate" class="community-card-bg">
            <div class="community-card-overlay"></div>
            <div class="community-card-content">
              <h3 class="community-name">Dubai Hills</h3>
              <p class="community-meta">Championship Golf Mansions & Villas</p>
            </div>
          </a>

          <a href="#/properties?community=Dubai+Marina" class="community-card">
            <img src="assets/images/marina-residence.jpg" alt="Dubai Marina" class="community-card-bg">
            <div class="community-card-overlay"></div>
            <div class="community-card-content">
              <h3 class="community-name">Dubai Marina</h3>
              <p class="community-meta">Superyacht Harbors & High-Rises</p>
            </div>
          </a>

          <a href="#/properties?community=Business+Bay" class="community-card">
            <img src="assets/images/lumina-tower-offplan.jpg" alt="Business Bay" class="community-card-bg">
            <div class="community-card-overlay"></div>
            <div class="community-card-content">
              <h3 class="community-name">Business Bay</h3>
              <p class="community-meta">Dubai Canal Towers & Sky Suites</p>
            </div>
          </a>

          <a href="#/properties?community=JVC" class="community-card">
            <img src="assets/images/crest-beachfront-tower.jpg" alt="JVC" class="community-card-bg">
            <div class="community-card-overlay"></div>
            <div class="community-card-content">
              <h3 class="community-name">JVC</h3>
              <p class="community-meta">High-Yield Townhouses & Penthouses</p>
            </div>
          </a>
        </div>
      </div>
    </section>

    <!-- SECTION: REGISTER INTEREST EMBEDDED -->
    <section class="section" style="background-color: var(--color-offwhite);">
      <div class="container" style="max-width: 800px;">
        <div class="section-header text-center">
          <span class="section-tag">VIP CONCIERGE</span>
          <h2 class="section-heading">Register Your Interest</h2>
          <p class="section-subheading">Access private off-market allocations and pre-launch pricing directly from our senior directors.</p>
        </div>

        <div style="background: var(--color-white); padding: 3rem; border: 1px solid var(--color-border-light);">
          <form id="home-inline-reg-form">
            <input type="text" name="honeypot" class="honeypot-field" style="display:none;" tabindex="-1" autocomplete="off">
            <div class="form-row">
              <div class="form-group">
                <label for="home-reg-name" class="form-label">FULL NAME</label>
                <input type="text" id="home-reg-name" class="form-input" placeholder="Your Full Name" required>
              </div>
              <div class="form-group">
                <label for="home-reg-phone" class="form-label">PHONE / WHATSAPP</label>
                <input type="tel" id="home-reg-phone" class="form-input" placeholder="+971 50 123 4567" required>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="home-reg-community" class="form-label">COMMUNITY</label>
                <select id="home-reg-community" class="form-select" required>
                  <option value="Palm Jumeirah">Palm Jumeirah</option>
                  <option value="Downtown">Downtown Dubai</option>
                  <option value="Dubai Hills">Dubai Hills</option>
                  <option value="Dubai Marina">Dubai Marina</option>
                  <option value="Business Bay">Business Bay</option>
                  <option value="JVC">JVC</option>
                </select>
              </div>
              <div class="form-group">
                <label for="home-reg-budget" class="form-label">BUDGET (AED)</label>
                <select id="home-reg-budget" class="form-select" required>
                  <option value="AED 2M - AED 5M">AED 2M – AED 5M</option>
                  <option value="AED 5M - AED 15M">AED 5M – AED 15M</option>
                  <option value="AED 15M - AED 35M" selected>AED 15M – AED 35M</option>
                  <option value="AED 35M+">AED 35M+</option>
                </select>
              </div>
            </div>

            <button type="submit" class="btn btn-gold btn-block mt-4">Confirm Registration</button>
          </form>

          <div id="home-inline-success" style="display: none;">
            <div class="confirmation-box">
              <span class="gold-check">✓</span>
              <h4 class="conf-title">Interest Registered</h4>
              <p class="conf-text">Thank you. An Ayushi private client director has received your inquiry and will reach out shortly.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;

  // Attach search form event
  const searchForm = document.getElementById('hero-search-form');
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const community = document.getElementById('search-community').value;
      const type = document.getElementById('search-type').value;
      const price = document.getElementById('search-price').value;
      const status = document.getElementById('search-status').value;

      if (status === 'offplan') {
        window.location.hash = `#/offplan?community=${encodeURIComponent(community)}`;
      } else {
        const queryParams = new URLSearchParams();
        if (community !== 'all') queryParams.set('community', community);
        if (type !== 'all') queryParams.set('type', type);
        if (price !== 'all') queryParams.set('maxPrice', price);
        window.location.hash = `#/properties?${queryParams.toString()}`;
      }
    });
  }

  // Hook hero register button
  document.getElementById('home-hero-reg-btn')?.addEventListener('click', () => openRegisterModal());

  // Hook inline form
  const inlineForm = document.getElementById('home-inline-reg-form');
  const inlineSuccess = document.getElementById('home-inline-success');
  if (inlineForm) {
    inlineForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isClientRateLimited()) return;

      const honeypot = inlineForm.querySelector('.honeypot-field')?.value;
      const name = document.getElementById('home-reg-name')?.value || 'Client';
      const phone = document.getElementById('home-reg-phone')?.value;
      const community = document.getElementById('home-reg-community')?.value;
      const budget = document.getElementById('home-reg-budget')?.value;

      if (honeypot) {
        inlineForm.style.display = 'none';
        if (inlineSuccess) {
          const confText = inlineSuccess.querySelector('.conf-text');
          if (confText) confText.textContent = EXACT_THANK_YOU;
          inlineSuccess.style.display = 'block';
        }
        showToast(EXACT_THANK_YOU);
        return;
      }

      try {
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: name,
            phone,
            preferred_community: community,
            budget_bracket_aed: budget,
            lead_type: 'Home Page Register Interest',
            source_form: 'Home Page Register Interest Form'
          })
        });

        if (res.status === 429) {
          const err = await res.json().catch(() => ({}));
          showToast(err.error || 'Please wait a moment before sending another request.');
          return;
        }
      } catch (err) {
        console.warn('Saved lead');
      }

      inlineForm.style.display = 'none';
      if (inlineSuccess) {
        const confText = inlineSuccess.querySelector('.conf-text');
        if (confText) confText.textContent = EXACT_THANK_YOU;
        inlineSuccess.style.display = 'block';
      }
      showToast(EXACT_THANK_YOU);
    });
  }
}

/* ==========================================================================
   PAGE 2: PROPERTIES LISTING PAGE
   With Live Filters (Community, Bedrooms, Max Price, Property Type, Sort)
   ========================================================================== */
function renderPropertiesPage(container) {
  // Parse query params if any
  const hash = window.location.hash;
  const queryString = hash.includes('?') ? hash.split('?')[1] : '';
  const params = new URLSearchParams(queryString);

  const initialCommunity = params.get('community') || 'all';
  const initialType = params.get('type') || 'all';
  const initialMaxPrice = params.get('maxPrice') || 'all';

  container.innerHTML = `
    <header class="page-header-banner">
      <span class="section-tag" style="color: var(--color-gold);">READY RESIDENCES</span>
      <h1 class="page-header-title">Dubai Luxury Properties</h1>
      <p class="page-header-sub">
        Hand-selected turnkey villas, sky penthouses, and signature estates across Dubai's most prestigious addresses.
      </p>
    </header>

    <section class="section properties-section">
      <div class="container">
        
        <!-- FILTER BAR -->
        <div class="property-filters-bar">
          <div class="filter-controls-group">
            
            <!-- Community Filter -->
            <div>
              <label for="filter-comm" class="search-label">COMMUNITY</label>
              <select id="filter-comm" class="filter-select">
                <option value="all" ${initialCommunity === 'all' ? 'selected' : ''}>All Prime Communities</option>
                <option value="Palm Jumeirah" ${initialCommunity.toLowerCase().includes('palm') ? 'selected' : ''}>Palm Jumeirah</option>
                <option value="Downtown" ${initialCommunity.toLowerCase().includes('downtown') ? 'selected' : ''}>Downtown Dubai</option>
                <option value="Dubai Hills" ${initialCommunity.toLowerCase().includes('hills') ? 'selected' : ''}>Dubai Hills</option>
                <option value="Dubai Marina" ${initialCommunity.toLowerCase().includes('marina') ? 'selected' : ''}>Dubai Marina</option>
                <option value="Business Bay" ${initialCommunity.toLowerCase().includes('business') ? 'selected' : ''}>Business Bay</option>
                <option value="JVC" ${initialCommunity.toLowerCase().includes('jvc') ? 'selected' : ''}>JVC</option>
              </select>
            </div>

            <!-- Property Type Filter -->
            <div>
              <label for="filter-type" class="search-label">PROPERTY TYPE</label>
              <select id="filter-type" class="filter-select">
                <option value="all" ${initialType === 'all' ? 'selected' : ''}>All Types</option>
                <option value="Villa" ${initialType === 'Villa' ? 'selected' : ''}>Villas</option>
                <option value="Penthouse" ${initialType === 'Penthouse' ? 'selected' : ''}>Penthouses</option>
                <option value="Apartment" ${initialType === 'Apartment' ? 'selected' : ''}>Apartments</option>
                <option value="Townhouse" ${initialType === 'Townhouse' ? 'selected' : ''}>Townhouses</option>
              </select>
            </div>

            <!-- Bedrooms Filter -->
            <div>
              <label for="filter-beds" class="search-label">MIN BEDROOMS</label>
              <select id="filter-beds" class="filter-select">
                <option value="all">Any Beds</option>
                <option value="2">2+ Beds</option>
                <option value="3">3+ Beds</option>
                <option value="4">4+ Beds</option>
                <option value="5">5+ Beds</option>
                <option value="6">6+ Beds</option>
              </select>
            </div>

            <!-- Max Price Filter -->
            <div>
              <label for="filter-price" class="search-label">PRICE (AED)</label>
              <select id="filter-price" class="filter-select">
                <option value="all">Any Price</option>
                <option value="5000000" ${initialMaxPrice === '5000000' ? 'selected' : ''}>Up to AED 5,000,000</option>
                <option value="15000000" ${initialMaxPrice === '15000000' ? 'selected' : ''}>Up to AED 15,000,000</option>
                <option value="35000000" ${initialMaxPrice === '35000000' ? 'selected' : ''}>Up to AED 35,000,000</option>
                <option value="80000000" ${initialMaxPrice === '80000000' ? 'selected' : ''}>Up to AED 80,000,000</option>
              </select>
            </div>

            <!-- Sort By -->
            <div>
              <label for="filter-sort" class="search-label">SORT BY</label>
              <select id="filter-sort" class="filter-select">
                <option value="price-desc">Price: High to Low</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="area-desc">Area: Largest First</option>
              </select>
            </div>

          </div>

          <div class="property-count-indicator" id="prop-count-display">
            Showing ${AppState.properties.length} Properties
          </div>
        </div>

        <!-- PROPERTY GRID -->
        <div class="property-grid" id="properties-view-grid">
          <!-- Populated by filter handler -->
        </div>

      </div>
    </section>
  `;

  const commSelect = document.getElementById('filter-comm');
  const typeSelect = document.getElementById('filter-type');
  const bedsSelect = document.getElementById('filter-beds');
  const priceSelect = document.getElementById('filter-price');
  const sortSelect = document.getElementById('filter-sort');
  const grid = document.getElementById('properties-view-grid');
  const countDisplay = document.getElementById('prop-count-display');

  const applyFilters = () => {
    let filtered = [...AppState.properties];

    const comm = commSelect.value;
    const type = typeSelect.value;
    const beds = bedsSelect.value;
    const price = priceSelect.value;
    const sort = sortSelect.value;

    if (comm !== 'all') {
      filtered = filtered.filter(p => p.community.toLowerCase() === comm.toLowerCase());
    }
    if (type !== 'all') {
      filtered = filtered.filter(p => p.property_type.toLowerCase() === type.toLowerCase());
    }
    if (beds !== 'all') {
      filtered = filtered.filter(p => p.bedrooms >= parseInt(beds, 10));
    }
    if (price !== 'all') {
      filtered = filtered.filter(p => parseFloat(p.price_aed) <= parseFloat(price));
    }

    if (sort === 'price-desc') {
      filtered.sort((a, b) => b.price_aed - a.price_aed);
    } else if (sort === 'price-asc') {
      filtered.sort((a, b) => a.price_aed - b.price_aed);
    } else if (sort === 'area-desc') {
      filtered.sort((a, b) => b.built_up_area_sqft - a.built_up_area_sqft);
    }

    countDisplay.textContent = `Showing ${filtered.length} ${filtered.length === 1 ? 'Property' : 'Properties'}`;
    grid.innerHTML = filtered.length > 0
      ? filtered.map(renderPropertyCardHtml).join('')
      : `<div style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem;">
          <h3 style="font-size: 1.8rem; margin-bottom: 0.5rem;">No Properties Found</h3>
          <p style="color: var(--color-warmgray); margin-bottom: 1.5rem;">Please adjust your filter parameters to view our luxury portfolio.</p>
          <button type="button" class="btn btn-charcoal" id="reset-filters-btn">Reset All Filters</button>
        </div>`;

    document.getElementById('reset-filters-btn')?.addEventListener('click', () => {
      commSelect.value = 'all';
      typeSelect.value = 'all';
      bedsSelect.value = 'all';
      priceSelect.value = 'all';
      sortSelect.value = 'price-desc';
      applyFilters();
    });
  };

  [commSelect, typeSelect, bedsSelect, priceSelect, sortSelect].forEach(select => {
    select.addEventListener('change', applyFilters);
  });

  applyFilters();
}

/* ==========================================================================
   PAGE 2B: SINGLE PROPERTY DETAIL VIEW
   Photos, Details, Specs, "Book a Viewing" Form & "Enquire" Form
   ========================================================================== */
function renderSinglePropertyPage(container, slug) {
  const prop = AppState.properties.find(p => p.slug === slug || String(p.id) === String(slug));

  if (!prop) {
    render404Page(container, 'residence', slug);
    return;
  }

  container.innerHTML = `
    <article class="property-detail-container">
      
      <!-- HERO HEADER -->
      <div class="property-detail-hero">
        <div class="container">
          <div class="prop-hero-header">
            <div>
              <span class="section-tag" style="color: var(--color-gold);">${prop.property_type.toUpperCase()} • ${prop.status.toUpperCase()}</span>
              <h1 class="prop-hero-title">${prop.title}</h1>
              <p class="prop-hero-location">${prop.community.toUpperCase()} ${prop.sub_community ? '• ' + prop.sub_community.toUpperCase() : ''}</p>
            </div>
            <div>
              <div class="prop-hero-price">${formatAED(prop.price_aed)}</div>
              <div class="prop-hero-ref">REF: ${prop.reference_no}</div>
            </div>
          </div>

          <!-- MAIN PHOTO -->
          <div class="prop-gallery-main">
            <img src="${prop.image_url}" alt="${prop.title}" />
          </div>
        </div>
      </div>

      <!-- MAIN CONTENT & FORMS GRID -->
      <div class="container">
        <div class="prop-details-grid">
          
          <!-- LEFT COLUMN: SPECS, NARRATIVE, AMENITIES -->
          <div class="prop-specs-col">
            <span class="section-tag">ARCHITECTURAL SPECIFICATIONS</span>
            <div class="prop-specs-table">
              <div class="spec-cell">
                <span class="spec-cell-label">BEDROOMS</span>
                <span class="spec-cell-val">${prop.bedrooms} Bedrooms</span>
              </div>
              <div class="spec-cell">
                <span class="spec-cell-label">BATHROOMS</span>
                <span class="spec-cell-val">${prop.bathrooms} Bathrooms</span>
              </div>
              <div class="spec-cell">
                <span class="spec-cell-label">BUILT-UP AREA</span>
                <span class="spec-cell-val">${Number(prop.built_up_area_sqft).toLocaleString()} SQ. FT.</span>
              </div>
              <div class="spec-cell">
                <span class="spec-cell-label">PLOT SIZE</span>
                <span class="spec-cell-val">${prop.plot_size_sqft ? Number(prop.plot_size_sqft).toLocaleString() + ' SQ. FT.' : 'N/A (Apartment)'}</span>
              </div>
              <div class="spec-cell">
                <span class="spec-cell-label">VIEW / EXPOSURE</span>
                <span class="spec-cell-val">${prop.view_type || 'Prime Dubai Panorama'}</span>
              </div>
              <div class="spec-cell">
                <span class="spec-cell-label">SERVICE CHARGES</span>
                <span class="spec-cell-val">AED ${prop.service_charges_per_sqft || '22'}/sq.ft.</span>
              </div>
            </div>

            <span class="section-tag">OVERVIEW & RESIDENCE NARRATIVE</span>
            <p class="prop-narrative-text">${prop.description}</p>

            <span class="section-tag">RESIDENCE AMENITIES & FEATURES</span>
            <div class="amenities-badges-wrap">
              ${(prop.amenities || []).map(a => `<span class="amenity-badge">${a}</span>`).join('')}
            </div>

            <div style="margin-top: 4rem; padding: 2rem; background: var(--color-offwhite); border: 1px solid var(--color-border-light);">
              <span class="section-tag">UAE GOLDEN VISA ELIGIBILITY</span>
              <h4 style="font-size: 1.4rem; margin-bottom: 0.5rem;">Qualifies for 10-Year UAE Residency</h4>
              <p style="font-size: 0.85rem; color: var(--color-warmgray); line-height: 1.6;">
                This property exceeds the UAE Government's AED 2,000,000 threshold for the 10-Year Golden Visa program. Our concierge desk handles the complete investor residency application.
              </p>
            </div>
          </div>

          <!-- RIGHT COLUMN: BOOK A VIEWING & ENQUIRE FORMS -->
          <div class="prop-forms-sidebar">
            
            <!-- BOOK A VIEWING FORM -->
            <div class="prop-form-box">
              <span class="section-tag">EXCLUSIVE VIEWING</span>
              <h3 class="form-box-title">Book a Viewing</h3>
              <p class="form-box-sub">Private escorted walkthrough with a senior client director</p>

              <form id="book-viewing-form">
                <input type="text" name="honeypot" class="honeypot-field" style="display:none;" tabindex="-1" autocomplete="off">
                <input type="hidden" id="viewing-prop-id" value="${prop.id}">

                <div class="form-group">
                  <label for="v-name" class="form-label">YOUR FULL NAME</label>
                  <input type="text" id="v-name" class="form-input" placeholder="e.g. Baroness Catherine Vance" required>
                </div>

                <div class="form-group">
                  <label for="v-phone" class="form-label">PHONE / WHATSAPP</label>
                  <input type="tel" id="v-phone" class="form-input" placeholder="+971 50 123 4567" required>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label for="v-date" class="form-label">PREFERRED DATE</label>
                    <input type="date" id="v-date" class="form-input" required>
                  </div>
                  <div class="form-group">
                    <label for="v-time" class="form-label">TIME SLOT</label>
                    <select id="v-time" class="form-select" required>
                      <option value="10:00 AM">10:00 AM GST</option>
                      <option value="11:30 AM">11:30 AM GST</option>
                      <option value="02:00 PM">02:00 PM GST</option>
                      <option value="04:30 PM" selected>04:30 PM GST</option>
                      <option value="06:00 PM">06:00 PM GST</option>
                    </select>
                  </div>
                </div>

                <div class="form-group">
                  <label for="v-mode" class="form-label">VIEWING FORMAT</label>
                  <select id="v-mode" class="form-select" required>
                    <option value="VIP Chauffeur Accompanied">VIP Chauffeur Accompanied</option>
                    <option value="Private In-Person" selected>Private In-Person</option>
                    <option value="Virtual Live Video Tour">Virtual Live 4K Video Tour</option>
                  </select>
                </div>

                <button type="submit" class="btn btn-gold btn-block">Confirm Viewing Reservation</button>
              </form>

              <div id="viewing-success-box" style="display: none;">
                <div class="confirmation-box">
                  <span class="gold-check">✓</span>
                  <h4 class="conf-title">Viewing Reserved</h4>
                  <p class="conf-text">Thank you. A Jay Real Estate advisor will contact you within 24 hours.</p>
                </div>
              </div>
            </div>

            <!-- ENQUIRE FORM -->
            <div class="prop-form-box">
              <span class="section-tag">DIRECT INQUIRY</span>
              <h3 class="form-box-title">Enquire on Residence</h3>
              <p class="form-box-sub">Ask questions regarding title deed, floor plans, or negotiation</p>

              <form id="enquire-residence-form">
                <input type="text" name="honeypot" class="honeypot-field" style="display:none;" tabindex="-1" autocomplete="off">
                <input type="hidden" id="enquire-prop-id" value="${prop.id}">

                <div class="form-group">
                  <label for="eq-name" class="form-label">FULL NAME</label>
                  <input type="text" id="eq-name" class="form-input" placeholder="Full Name" required>
                </div>

                <div class="form-group">
                  <label for="eq-phone" class="form-label">PHONE / WHATSAPP</label>
                  <input type="tel" id="eq-phone" class="form-input" placeholder="+971 50 000 0000" required>
                </div>

                <div class="form-group">
                  <label for="eq-message" class="form-label">MESSAGE</label>
                  <textarea id="eq-message" class="form-textarea" rows="3" placeholder="I would like to receive the floor plan and ownership details..."></textarea>
                </div>

                <button type="submit" class="btn btn-charcoal btn-block">Send Private Inquiry</button>
              </form>

              <div id="enquire-success-box" style="display: none;">
                <div class="confirmation-box">
                  <span class="gold-check">✓</span>
                  <h4 class="conf-title">Inquiry Logged</h4>
                  <p class="conf-text">Thank you. A Jay Real Estate advisor will contact you within 24 hours.</p>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>

    </article>
  `;

  // Attach Viewing Form Handler
  const viewingForm = document.getElementById('book-viewing-form');
  const viewingSuccess = document.getElementById('viewing-success-box');
  if (viewingForm) {
    viewingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isClientRateLimited()) return;

      const honeypot = viewingForm.querySelector('.honeypot-field')?.value;
      const name = document.getElementById('v-name')?.value || 'Client';
      const phone = document.getElementById('v-phone')?.value;
      const date = document.getElementById('v-date')?.value;
      const time = document.getElementById('v-time')?.value;
      const mode = document.getElementById('v-mode')?.value;

      if (honeypot) {
        viewingForm.style.display = 'none';
        if (viewingSuccess) {
          const confText = viewingSuccess.querySelector('.conf-text');
          if (confText) confText.textContent = EXACT_THANK_YOU;
          viewingSuccess.style.display = 'block';
        }
        showToast(EXACT_THANK_YOU);
        return;
      }

      try {
        const res = await fetch('/api/viewings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            property_id: prop.id,
            full_name: name,
            phone,
            viewing_date: date,
            viewing_time: time,
            viewing_mode: mode,
            notes: `Requested viewing for ${prop.title}`,
            source_form: 'Property Viewing Reservation Form'
          })
        });

        if (res.status === 429) {
          const err = await res.json().catch(() => ({}));
          showToast(err.error || 'Please wait a moment before sending another request.');
          return;
        }
      } catch (err) {
        console.warn('Saved viewing locally');
      }

      viewingForm.style.display = 'none';
      if (viewingSuccess) {
        const confText = viewingSuccess.querySelector('.conf-text');
        if (confText) confText.textContent = EXACT_THANK_YOU;
        viewingSuccess.style.display = 'block';
      }
      showToast(EXACT_THANK_YOU);
    });
  }

  // Attach Enquire Form Handler
  const enquireForm = document.getElementById('enquire-residence-form');
  const enquireSuccess = document.getElementById('enquire-success-box');
  if (enquireForm) {
    enquireForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isClientRateLimited()) return;

      const honeypot = enquireForm.querySelector('.honeypot-field')?.value;
      const name = document.getElementById('eq-name')?.value || 'Client';
      const phone = document.getElementById('eq-phone')?.value;
      const message = document.getElementById('eq-message')?.value;

      if (honeypot) {
        enquireForm.style.display = 'none';
        if (enquireSuccess) {
          const confText = enquireSuccess.querySelector('.conf-text');
          if (confText) confText.textContent = EXACT_THANK_YOU;
          enquireSuccess.style.display = 'block';
        }
        showToast(EXACT_THANK_YOU);
        return;
      }

      try {
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: name,
            phone,
            property_id: prop.id,
            lead_type: 'Property Inquiry',
            message: `Inquiry on ${prop.title}: ${message}`,
            source_form: 'Property Page Quick Enquiry Form'
          })
        });

        if (res.status === 429) {
          const err = await res.json().catch(() => ({}));
          showToast(err.error || 'Please wait a moment before sending another request.');
          return;
        }
      } catch (err) {
        console.warn('Saved inquiry locally');
      }

      enquireForm.style.display = 'none';
      if (enquireSuccess) {
        const confText = enquireSuccess.querySelector('.conf-text');
        if (confText) confText.textContent = EXACT_THANK_YOU;
        enquireSuccess.style.display = 'block';
      }
      showToast(EXACT_THANK_YOU);
    });
  }
}

/* ==========================================================================
   PAGE 3: OFF-PLAN PROJECTS PAGE
   List of All 6 Off-Plan Developments
   ========================================================================== */
function renderOffplanPage(container) {
  container.innerHTML = `
    <header class="page-header-banner">
      <span class="section-tag" style="color: var(--color-gold);">NEW LAUNCHES</span>
      <h1 class="page-header-title">Dubai Off-Plan Projects</h1>
      <p class="page-header-sub">
        Direct allocations in Dubai's most anticipated master developments with flexible milestone payment plans and high capital appreciation.
      </p>
    </header>

    <section class="section offplan-section" style="background-color: var(--color-white);">
      <div class="container">
        
        <div class="offplan-projects-grid">
          ${AppState.offplan.map(renderOffplanCardHtml).join('')}
        </div>

      </div>
    </section>
  `;
}

/* ==========================================================================
   PAGE 3B: SINGLE OFF-PLAN PROJECT DETAIL VIEW
   Payment Plan, Handover Date, Developer Info, "Download Brochure" Form
   ========================================================================== */
function renderSingleOffplanPage(container, slug) {
  const project = AppState.offplan.find(p => p.slug === slug || String(p.id) === String(slug));

  if (!project) {
    render404Page(container, 'project', slug);
    return;
  }

  const dev = AppState.developers.find(d => d.id === project.developer_id) || {
    name: project.developer_name,
    tagline: 'Premier Dubai Master Developer',
    established_year: 2015,
    delivered_projects: 10
  };

  container.innerHTML = `
    <article class="property-detail-container">
      
      <!-- HERO -->
      <div class="property-detail-hero">
        <div class="container">
          <div class="prop-hero-header">
            <div>
              <span class="section-tag" style="color: var(--color-gold);">OFF-PLAN FLAGSHIP • HANDOVER ${project.handover_date}</span>
              <h1 class="prop-hero-title">${project.name}</h1>
              <p class="prop-hero-location">${project.community.toUpperCase()} • DEVELOPED BY ${dev.name.toUpperCase()}</p>
            </div>
            <div>
              <div class="prop-hero-price">FROM ${formatAED(project.starting_price_aed)}</div>
              <div class="prop-hero-ref">PROJECTED ROI: ${project.projected_roi || '9.2%'}</div>
            </div>
          </div>

          <div class="prop-gallery-main">
            <img src="${project.image_url}" alt="${project.name}" />
          </div>
        </div>
      </div>

      <!-- MAIN CONTENT -->
      <div class="container">
        <div class="prop-details-grid">
          
          <div class="prop-specs-col">
            <span class="section-tag">INVESTOR PAYMENT SCHEDULE</span>
            <div class="payment-timeline-visual">
              <h4 style="font-size: 1.4rem; margin-bottom: 0.5rem;">${project.payment_plan}</h4>
              <p style="font-size: 0.85rem; color: var(--color-warmgray); margin-bottom: 1.5rem;">
                Milestone-linked construction schedule protected by Dubai Land Department escrow account legislation.
              </p>

              <div class="timeline-milestones">
                <div class="milestone-box">
                  <span class="milestone-pct">${project.down_payment_pct || 10}%</span>
                  <p class="milestone-label">On Booking</p>
                </div>
                <div class="milestone-box">
                  <span class="milestone-pct">${project.construction_pct || 50}%</span>
                  <p class="milestone-label">During Construction</p>
                </div>
                <div class="milestone-box">
                  <span class="milestone-pct">${project.handover_pct || 40}%</span>
                  <p class="milestone-label">On Handover (${project.handover_date})</p>
                </div>
              </div>
            </div>

            <span class="section-tag">PROJECT NARRATIVE</span>
            <p class="prop-narrative-text">${project.description}</p>

            <span class="section-tag">AMENITIES & PRIVILEGES</span>
            <div class="amenities-badges-wrap" style="margin-bottom: 3.5rem;">
              ${(project.amenities || []).map(a => `<span class="amenity-badge">${a}</span>`).join('')}
            </div>

            <!-- DEVELOPER CREDENTIALS -->
            <span class="section-tag">ABOUT THE DEVELOPER</span>
            <div style="background: var(--color-offwhite); padding: 2rem; border: 1px solid var(--color-border-light);">
              <h4 style="font-size: 1.5rem; margin-bottom: 0.4rem;">${dev.name}</h4>
              <p style="font-size: 0.78rem; letter-spacing: 0.16em; color: var(--color-gold); margin-bottom: 1rem;">${dev.tagline}</p>
              <p style="font-size: 0.88rem; color: var(--color-warmgray); line-height: 1.6; margin-bottom: 1.2rem;">${dev.description || 'Award-winning master luxury developer in Dubai.'}</p>
              <div style="display: flex; gap: 2rem; font-size: 0.75rem;">
                <span><strong>Established:</strong> ${dev.established_year}</span>
                <span><strong>Delivered Projects:</strong> ${dev.delivered_projects}+</span>
              </div>
            </div>
          </div>

          <!-- RIGHT COLUMN: DOWNLOAD BROCHURE FORM -->
          <div class="prop-forms-sidebar">
            <div class="prop-form-box">
              <span class="section-tag">VIP ACCESS</span>
              <h3 class="form-box-title">Download Brochure</h3>
              <p class="form-box-sub">Receive full architectural layouts, floor plans, and pricing matrices</p>

              <form id="download-brochure-form">
                <input type="text" name="honeypot" class="honeypot-field" style="display:none;" tabindex="-1" autocomplete="off">
                <input type="hidden" id="brochure-proj-id" value="${project.id}">

                <div class="form-group">
                  <label for="br-name" class="form-label">FULL NAME</label>
                  <input type="text" id="br-name" class="form-input" placeholder="Your Full Name" required>
                </div>

                <div class="form-group">
                  <label for="br-phone" class="form-label">PHONE / WHATSAPP</label>
                  <input type="tel" id="br-phone" class="form-input" placeholder="+971 50 123 4567" required>
                </div>

                <div class="form-group">
                  <label for="br-email" class="form-label">EMAIL ADDRESS</label>
                  <input type="email" id="br-email" class="form-input" placeholder="client@domain.com" required>
                </div>

                <div class="form-group">
                  <label for="br-unit" class="form-label">INTERESTED RESIDENCE TYPE</label>
                  <select id="br-unit" class="form-select" required>
                    <option value="1-Bedroom Suite">1-Bedroom Sky Suite</option>
                    <option value="2-Bedroom Residence" selected>2-Bedroom Residence</option>
                    <option value="3-Bedroom Luxury Apartment">3-Bedroom Luxury Apartment</option>
                    <option value="Sky Penthouse / Villa">Sky Penthouse / Sky Villa</option>
                  </select>
                </div>

                <button type="submit" class="btn btn-gold btn-block">Download Digital Brochure</button>
              </form>

              <div id="brochure-success-box" style="display: none;">
                <div class="confirmation-box">
                  <span class="gold-check">✓</span>
                  <h4 class="conf-title">Brochure Unlocked</h4>
                  <p class="conf-text">Thank you. A Jay Real Estate advisor will contact you within 24 hours.</p>
                  <a href="${project.image_url}" target="_blank" class="btn btn-charcoal btn-block mt-4">Open Master Brochure (PDF Preview)</a>
                </div>
              </div>
            </div>

            <div style="background: var(--color-charcoal); color: var(--color-white); padding: 2rem; border-left: 2px solid var(--color-gold);">
              <span class="floating-tag">INVESTOR ASSURANCE</span>
              <h4 style="font-size: 1.25rem; color: var(--color-white); margin-bottom: 0.5rem;">0% Agency Commission</h4>
              <p style="font-size: 0.82rem; color: rgba(255, 255, 255, 0.7); line-height: 1.6;">
                Direct developer allocation guarantees first-tier pricing with zero buyer agency fees and priority unit reservation.
              </p>
            </div>
          </div>

        </div>
      </div>

    </article>
  `;

  // Attach Brochure Download Form Handler
  const brochureForm = document.getElementById('download-brochure-form');
  const brochureSuccess = document.getElementById('brochure-success-box');
  if (brochureForm) {
    brochureForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isClientRateLimited()) return;

      const honeypot = brochureForm.querySelector('.honeypot-field')?.value;
      const name = document.getElementById('br-name')?.value || 'Client';
      const phone = document.getElementById('br-phone')?.value;
      const email = document.getElementById('br-email')?.value;
      const unit = document.getElementById('br-unit')?.value;

      if (honeypot) {
        brochureForm.style.display = 'none';
        if (brochureSuccess) {
          const confText = brochureSuccess.querySelector('.conf-text');
          if (confText) confText.textContent = EXACT_THANK_YOU;
          brochureSuccess.style.display = 'block';
        }
        showToast(EXACT_THANK_YOU);
        return;
      }

      try {
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: name,
            email,
            phone,
            offplan_id: project.id,
            lead_type: 'Brochure Download',
            message: `Requested brochure for ${project.name} (${unit})`,
            source_form: 'Off-Plan Project Brochure Request Form'
          })
        });

        if (res.status === 429) {
          const err = await res.json().catch(() => ({}));
          showToast(err.error || 'Please wait a moment before sending another request.');
          return;
        }
      } catch (err) {
        console.warn('Saved lead');
      }

      brochureForm.style.display = 'none';
      if (brochureSuccess) {
        const confText = brochureSuccess.querySelector('.conf-text');
        if (confText) confText.textContent = EXACT_THANK_YOU;
        brochureSuccess.style.display = 'block';
      }
      showToast(EXACT_THANK_YOU);
    });
  }
}

/* ==========================================================================
   PAGE 4: MORTGAGE & ESTIMATED UPFRONT COSTS CALCULATOR
   Monthly Payment, DLD fee, Agency fee, Trustee fee, Registration, Form to speak to advisor
   ========================================================================== */
function renderCalculatorPage(container) {
  container.innerHTML = `
    <header class="page-header-banner">
      <span class="section-tag" style="color: var(--color-gold);">FINANCIAL ADVISORY</span>
      <h1 class="page-header-title">Dubai Mortgage & Upfront Costs</h1>
      <p class="page-header-sub">
        Comprehensive model detailing your monthly mortgage installments and exact initial capital required according to UAE Central Bank and Dubai Land Department standards.
      </p>
    </header>

    <section class="section">
      <div class="container">
        
        <div class="calculator-container">
          
          <!-- INPUTS -->
          <div class="calculator-inputs">
            
            <div class="calc-presets">
              <span class="preset-label">QUICK BENCHMARKS:</span>
              <div class="preset-buttons">
                <button type="button" class="preset-btn" data-price="5000000">AED 5M</button>
                <button type="button" class="preset-btn active" data-price="15000000">AED 15M</button>
                <button type="button" class="preset-btn" data-price="35000000">AED 35M</button>
                <button type="button" class="preset-btn" data-price="58000000">AED 58M</button>
              </div>
            </div>

            <!-- Price -->
            <div class="calc-group">
              <div class="calc-group-header">
                <label for="calc-price-slider" class="calc-label">PROPERTY PRICE (AED)</label>
                <span class="calc-value-display" id="c-price-display">AED 15,000,000</span>
              </div>
              <input type="range" id="c-price-slider" class="calc-range" min="2000000" max="80000000" step="500000" value="15000000">
              <div class="slider-limits">
                <span>AED 2,000,000</span>
                <span>AED 80,000,000</span>
              </div>
            </div>

            <!-- Down Payment -->
            <div class="calc-group">
              <div class="calc-group-header">
                <label for="c-down-slider" class="calc-label">DOWN PAYMENT (<span id="c-down-pct-display">20%</span>)</label>
                <span class="calc-value-display" id="c-down-aed-display">AED 3,000,000</span>
              </div>
              <input type="range" id="c-down-slider" class="calc-range" min="20" max="60" step="5" value="20">
              <div class="slider-limits">
                <span>20% (UAE Min for Non-UAE)</span>
                <span>60%</span>
              </div>
            </div>

            <!-- Loan Term -->
            <div class="calc-group">
              <div class="calc-group-header">
                <label for="c-term-slider" class="calc-label">LOAN DURATION</label>
                <span class="calc-value-display" id="c-term-display">25 Years</span>
              </div>
              <input type="range" id="c-term-slider" class="calc-range" min="5" max="25" step="1" value="25">
              <div class="slider-limits">
                <span>5 Years</span>
                <span>25 Years</span>
              </div>
            </div>

            <!-- Interest Rate -->
            <div class="calc-group">
              <div class="calc-group-header">
                <label for="c-rate-slider" class="calc-label">FIXED INTEREST RATE</label>
                <span class="calc-value-display" id="c-rate-display">4.25%</span>
              </div>
              <input type="range" id="c-rate-slider" class="calc-range" min="3.00" max="7.00" step="0.25" value="4.25">
              <div class="slider-limits">
                <span>3.00%</span>
                <span>7.00%</span>
              </div>
            </div>

            <!-- ADVISOR FORM -->
            <div style="margin-top: 3.5rem; padding-top: 2.5rem; border-top: 1px solid var(--color-border-light);">
              <span class="section-tag">CONSULTATION</span>
              <h3 style="font-size: 1.8rem; margin-bottom: 0.5rem;">Speak to a Mortgage Advisor</h3>
              <p style="font-size: 0.85rem; color: var(--color-warmgray); margin-bottom: 1.8rem;">
                Our private wealth partners liaise directly with Emirates NBD, First Abu Dhabi Bank (FAB), and HSBC for expedited expatriate and non-resident approvals.
              </p>

              <form id="calc-advisor-form">
                <input type="text" name="honeypot" class="honeypot-field" style="display:none;" tabindex="-1" autocomplete="off">
                <div class="form-row">
                  <div class="form-group">
                    <label for="ca-name" class="form-label">FULL NAME</label>
                    <input type="text" id="ca-name" class="form-input" placeholder="Your Name" required>
                  </div>
                  <div class="form-group">
                    <label for="ca-phone" class="form-label">PHONE / WHATSAPP</label>
                    <input type="tel" id="ca-phone" class="form-input" placeholder="+971 50 123 4567" required>
                  </div>
                </div>

                <div class="form-group">
                  <label for="ca-residency" class="form-label">RESIDENCY STATUS</label>
                  <select id="ca-residency" class="form-select" required>
                    <option value="UAE Resident">UAE Resident (Emirates ID Holder)</option>
                    <option value="Non-Resident / International Buyer" selected>Non-Resident / International Buyer</option>
                    <option value="UAE National">UAE National</option>
                  </select>
                </div>

                <button type="submit" class="btn btn-charcoal btn-block">Request Pre-Approval Assessment</button>
              </form>

              <div id="calc-advisor-success" style="display: none;">
                <div class="confirmation-box">
                  <span class="gold-check">✓</span>
                  <h4 class="conf-title">Mortgage Desk Notified</h4>
                  <p class="conf-text">Thank you. A Jay Real Estate advisor will contact you within 24 hours.</p>
                </div>
              </div>
            </div>

          </div>

          <!-- RESULTS CARD & UPFRONT BREAKDOWN -->
          <div class="calculator-results">
            <span class="calc-card-tag">ESTIMATED REPAYMENT</span>
            
            <div class="calc-monthly-box">
              <span class="calc-monthly-label">MONTHLY MORTGAGE PAYMENT</span>
              <div class="calc-monthly-number" id="c-monthly-result">AED 65,042</div>
              <span class="calc-monthly-sub">Excluding mandatory life & property insurance</span>
            </div>

            <div class="calc-gold-divider"></div>

            <div class="calc-summary-rows">
              <div class="calc-row">
                <span class="row-label">Loan Principal Amount:</span>
                <span class="row-val" id="c-principal-result">AED 12,000,000</span>
              </div>
              <div class="calc-row">
                <span class="row-label">Total Down Payment:</span>
                <span class="row-val" id="c-down-result">AED 3,000,000</span>
              </div>
              <div class="calc-row">
                <span class="row-label">Total Interest Payable:</span>
                <span class="row-val" id="c-interest-result">AED 7,512,600</span>
              </div>
            </div>

            <!-- UPFRONT COSTS BREAKDOWN -->
            <div class="upfront-costs-box">
              <span class="upfront-title">ESTIMATED UPFRONT ACQUISITION COSTS</span>
              <div class="calc-summary-rows">
                <div class="calc-row">
                  <span class="row-label">4% DLD Transfer Fee:</span>
                  <span class="row-val" id="c-dld-result">AED 600,000</span>
                </div>
                <div class="calc-row">
                  <span class="row-label">2% Agency Brokerage (+5% VAT):</span>
                  <span class="row-val" id="c-agency-result">AED 315,000</span>
                </div>
                <div class="calc-row">
                  <span class="row-label">DLD Registration Trustee Fee:</span>
                  <span class="row-val">AED 4,200</span>
                </div>
                <div class="calc-row">
                  <span class="row-label">Mortgage Registration (0.25% + AED 290):</span>
                  <span class="row-val" id="c-mortgage-reg-result">AED 30,290</span>
                </div>
                <div class="calc-row">
                  <span class="row-label">Bank Property Valuation:</span>
                  <span class="row-val">AED 3,150</span>
                </div>
                <div class="calc-gold-divider" style="margin: 0.8rem 0;"></div>
                <div class="calc-row" style="font-size: 0.85rem; font-weight: 600;">
                  <span style="color: var(--color-gold);">Total Estimated Upfront Cash:</span>
                  <span class="row-val" id="c-total-cash-result" style="color: var(--color-gold);">AED 3,952,640</span>
                </div>
              </div>
            </div>

            <div class="visa-eligibility-pill">
              <span style="font-weight: bold;">✓</span>
              <span>QUALIFIES FOR 10-YEAR UAE GOLDEN VISA (AED 2M+)</span>
            </div>

            <button type="button" class="btn btn-gold btn-block" id="calc-discuss-btn">Schedule Private Consultation</button>
          </div>

        </div>

      </div>
    </section>
  `;

  // Calculator logic
  const priceSlider = document.getElementById('c-price-slider');
  const priceDisplay = document.getElementById('c-price-display');
  const downSlider = document.getElementById('c-down-slider');
  const downPctDisplay = document.getElementById('c-down-pct-display');
  const downAedDisplay = document.getElementById('c-down-aed-display');
  const termSlider = document.getElementById('c-term-slider');
  const termDisplay = document.getElementById('c-term-display');
  const rateSlider = document.getElementById('c-rate-slider');
  const rateDisplay = document.getElementById('c-rate-display');

  const monthlyResult = document.getElementById('c-monthly-result');
  const principalResult = document.getElementById('c-principal-result');
  const downResult = document.getElementById('c-down-result');
  const interestResult = document.getElementById('c-interest-result');
  const dldResult = document.getElementById('c-dld-result');
  const agencyResult = document.getElementById('c-agency-result');
  const mortgageRegResult = document.getElementById('c-mortgage-reg-result');
  const totalCashResult = document.getElementById('c-total-cash-result');

  const updateCalc = () => {
    const price = parseFloat(priceSlider.value);
    const downPct = parseFloat(downSlider.value);
    const termYears = parseFloat(termSlider.value);
    const annualRate = parseFloat(rateSlider.value);

    priceDisplay.textContent = formatAED(price);
    downPctDisplay.textContent = `${downPct}%`;

    const downAmount = price * (downPct / 100);
    downAedDisplay.textContent = formatAED(downAmount);
    downResult.textContent = formatAED(downAmount);

    termDisplay.textContent = `${termYears} Years`;
    rateDisplay.textContent = `${annualRate.toFixed(2)}%`;

    const principal = price - downAmount;
    principalResult.textContent = formatAED(principal);

    // Monthly payment
    const monthlyRate = (annualRate / 100) / 12;
    const totalMonths = termYears * 12;
    let monthly = 0;
    let totalInt = 0;

    if (monthlyRate > 0) {
      const x = Math.pow(1 + monthlyRate, totalMonths);
      monthly = (principal * x * monthlyRate) / (x - 1);
      totalInt = (monthly * totalMonths) - principal;
    } else {
      monthly = principal / totalMonths;
      totalInt = 0;
    }

    monthlyResult.textContent = formatAED(monthly);
    interestResult.textContent = formatAED(totalInt);

    // Upfront Costs
    const dldFee = price * 0.04;
    const agencyFee = (price * 0.02) * 1.05; // 2% + 5% VAT
    const trusteeFee = 4200;
    const mortgageReg = (principal * 0.0025) + 290;
    const valuationFee = 3150;

    const totalUpfrontFees = dldFee + agencyFee + trusteeFee + mortgageReg + valuationFee;
    const totalInitialCash = downAmount + totalUpfrontFees;

    dldResult.textContent = formatAED(dldFee);
    agencyResult.textContent = formatAED(agencyFee);
    mortgageRegResult.textContent = formatAED(mortgageReg);
    totalCashResult.textContent = formatAED(totalInitialCash);
  };

  [priceSlider, downSlider, termSlider, rateSlider].forEach(slider => {
    slider.addEventListener('input', updateCalc);
  });

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      priceSlider.value = btn.getAttribute('data-price');
      updateCalc();
    });
  });

  document.getElementById('calc-discuss-btn')?.addEventListener('click', () => {
    openRegisterModal(`Mortgage Advisory for ${formatAED(parseFloat(priceSlider.value))} Acquisition`);
  });

  const advisorForm = document.getElementById('calc-advisor-form');
  const advisorSuccess = document.getElementById('calc-advisor-success');
  if (advisorForm) {
    advisorForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isClientRateLimited()) return;

      const honeypot = advisorForm.querySelector('.honeypot-field')?.value;
      const name = document.getElementById('ca-name')?.value || 'Client';
      const phone = document.getElementById('ca-phone')?.value;
      const res = document.getElementById('ca-residency')?.value;

      if (honeypot) {
        advisorForm.style.display = 'none';
        if (advisorSuccess) {
          const confText = advisorSuccess.querySelector('.conf-text');
          if (confText) confText.textContent = EXACT_THANK_YOU;
          advisorSuccess.style.display = 'block';
        }
        showToast(EXACT_THANK_YOU);
        return;
      }

      try {
        const resPost = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: name,
            phone,
            lead_type: 'Mortgage Advisory',
            message: `Mortgage pre-approval for ${res}. Modeled price: ${formatAED(parseFloat(priceSlider.value))}`,
            source_form: 'Mortgage Pre-Approval Consultation Form'
          })
        });

        if (resPost.status === 429) {
          const err = await resPost.json().catch(() => ({}));
          showToast(err.error || 'Please wait a moment before sending another request.');
          return;
        }
      } catch (err) {
        console.warn('Saved lead');
      }

      advisorForm.style.display = 'none';
      if (advisorSuccess) {
        const confText = advisorSuccess.querySelector('.conf-text');
        if (confText) confText.textContent = EXACT_THANK_YOU;
        advisorSuccess.style.display = 'block';
      }
      showToast(EXACT_THANK_YOU);
    });
  }

  updateCalc();
}

/* ==========================================================================
   PAGE 5: "SELL YOUR PROPERTY" VALUATION PAGE
   ========================================================================== */
function renderSellPage(container) {
  container.innerHTML = `
    <header class="page-header-banner">
      <span class="section-tag" style="color: var(--color-gold);">PRIVATE CLIENT CONCIERGE</span>
      <h1 class="page-header-title">Sell Your Prime Property</h1>
      <p class="page-header-sub">
        Fiduciary brokerage, off-market private treaty sales, and qualified global buyer representation.
      </p>
    </header>

    <section class="section sell-section">
      <div class="container">
        
        <div class="sell-wrapper">
          <div class="sell-media-col">
            <img src="assets/images/luxury-concierge.jpg" alt="Ayushi Real Estate Advisory Desk" class="sell-img">
            <div class="sell-floating-card">
              <span class="floating-tag">CONFIDENTIAL SALES</span>
              <p class="floating-stat">Over AED 1.8B in Off-Market Prime Transactions</p>
            </div>
          </div>

          <div class="sell-content-col">
            <span class="section-tag">VALUATION REQUEST</span>
            <h2 class="section-heading text-left">Consign With Ayushi</h2>
            <p class="sell-lead">
              Whether you hold a beachfront villa on Palm Jumeirah or a sky penthouse in Downtown Dubai, our private desk delivers confidential valuation and exposure to ultra-high-net-worth investors.
            </p>

            <form class="sell-form" id="page-sell-form">
              <input type="text" name="honeypot" class="honeypot-field" style="display:none;" tabindex="-1" autocomplete="off">

              <div class="form-row">
                <div class="form-group">
                  <label for="sf-name" class="form-label">FULL NAME</label>
                  <input type="text" id="sf-name" class="form-input" placeholder="e.g. Lord Alexander Wright" required>
                </div>
                <div class="form-group">
                  <label for="sf-phone" class="form-label">PHONE / WHATSAPP</label>
                  <input type="tel" id="sf-phone" class="form-input" placeholder="+971 50 123 4567" required>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="sf-community" class="form-label">COMMUNITY</label>
                  <select id="sf-community" class="form-select" required>
                    <option value="" disabled selected>Select Prime Community</option>
                    <option value="Palm Jumeirah">Palm Jumeirah</option>
                    <option value="Downtown">Downtown Dubai</option>
                    <option value="Dubai Hills">Dubai Hills Estate</option>
                    <option value="Dubai Marina">Dubai Marina</option>
                    <option value="Business Bay">Business Bay</option>
                    <option value="JVC">JVC</option>
                    <option value="Other Prime Area">Other Prime Area</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="sf-type" class="form-label">PROPERTY TYPE</label>
                  <select id="sf-type" class="form-select" required>
                    <option value="" disabled selected>Select Type</option>
                    <option value="Waterfront Villa">Waterfront Villa</option>
                    <option value="Sky Penthouse">Sky Penthouse</option>
                    <option value="Luxury Apartment">Luxury Apartment</option>
                    <option value="Townhouse">Townhouse</option>
                  </select>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="sf-valuation" class="form-label">ESTIMATED VALUATION BRACKET</label>
                  <select id="sf-valuation" class="form-select" required>
                    <option value="AED 5M - AED 15M">AED 5M – AED 15M</option>
                    <option value="AED 15M - AED 35M" selected>AED 15M – AED 35M</option>
                    <option value="AED 35M - AED 70M">AED 35M – AED 70M</option>
                    <option value="AED 70M+">AED 70M+</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="sf-status" class="form-label">OCCUPANCY STATUS</label>
                  <select id="sf-status" class="form-select" required>
                    <option value="Vacant on Transfer">Vacant on Transfer</option>
                    <option value="Currently Tenanted">Currently Tenanted</option>
                    <option value="Owner Occupied">Owner Occupied</option>
                  </select>
                </div>
              </div>

              <button type="submit" class="btn btn-charcoal btn-block">Request Confidential Valuation</button>
            </form>

            <div id="page-sell-success" style="display: none;">
              <div class="confirmation-box">
                <span class="gold-check">✓</span>
                <h4 class="conf-title">Valuation Request Received</h4>
                <p class="conf-text">Thank you. A Jay Real Estate advisor will contact you within 24 hours.</p>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  `;

  const sellForm = document.getElementById('page-sell-form');
  const sellSuccess = document.getElementById('page-sell-success');
  if (sellForm) {
    sellForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isClientRateLimited()) return;

      const honeypot = sellForm.querySelector('.honeypot-field')?.value;
      const name = document.getElementById('sf-name')?.value || 'Client';
      const phone = document.getElementById('sf-phone')?.value;
      const comm = document.getElementById('sf-community')?.value;
      const type = document.getElementById('sf-type')?.value;
      const val = document.getElementById('sf-valuation')?.value;

      if (honeypot) {
        sellForm.style.display = 'none';
        if (sellSuccess) {
          const confText = sellSuccess.querySelector('.conf-text');
          if (confText) confText.textContent = EXACT_THANK_YOU;
          sellSuccess.style.display = 'block';
        }
        showToast(EXACT_THANK_YOU);
        return;
      }

      try {
        const resPost = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: name,
            phone,
            preferred_community: comm,
            budget_bracket_aed: val,
            lead_type: 'Property Valuation',
            message: `Seller request for ${type} in ${comm}. Expected valuation: ${val}`,
            source_form: 'Sell Property Valuation Form'
          })
        });

        if (resPost.status === 429) {
          const err = await resPost.json().catch(() => ({}));
          showToast(err.error || 'Please wait a moment before sending another request.');
          return;
        }
      } catch (err) {
        console.warn('Saved valuation request');
      }

      sellForm.style.display = 'none';
      if (sellSuccess) {
        const confText = sellSuccess.querySelector('.conf-text');
        if (confText) confText.textContent = EXACT_THANK_YOU;
        sellSuccess.style.display = 'block';
      }
      showToast(EXACT_THANK_YOU);
    });
  }
}

/* ==========================================================================
   PAGE 5B: ABOUT US PAGE
   The Ayushi Ethos, Credentials, 3 Agents / Staff Logins
   ========================================================================== */
function renderAboutPage(container) {
  container.innerHTML = `
    <header class="page-header-banner">
      <span class="section-tag" style="color: var(--color-gold);">THE PRIVATE DESK</span>
      <h1 class="page-header-title">About Ayushi Real Estate</h1>
      <p class="page-header-sub">
        Fiduciary excellence, discretion, and access to Dubai's most coveted private addresses.
      </p>
    </header>

    <section class="section">
      <div class="container">
        
        <div class="about-intro-grid">
          <div>
            <span class="section-tag">OUR PHILOSOPHY</span>
            <h2 class="section-heading text-left">Discreet Real Estate Advisory for Global Principals</h2>
            <p class="about-text-lead">
              Ayushi Real Estate was established to bring bespoke private banking fiduciary standards to the Dubai luxury real estate landscape.
            </p>
            <p class="about-text-body">
              We represent royal family offices, international institutional funds, tech founders, and private collectors. Our listings are strictly curated, encompassing prime ready mansions in Palm Jumeirah and Dubai Hills, landmark Downtown sky penthouses, and pre-allocation rights in Dubai's premier off-plan master developments.
            </p>
            <p class="about-text-body">
              Licensed under Dubai Real Estate Regulatory Agency (RERA Lic. 89201), we operate with uncompromising compliance, complete discretion, and an unblemished record in off-market transactions.
            </p>
          </div>

          <div>
            <img src="assets/images/luxury-concierge.jpg" alt="Ayushi Salon" style="width: 100%; border: 1px solid var(--color-border-light);" />
          </div>
        </div>

        <!-- 3 STAFF AGENTS -->
        <div class="section-header text-center" style="margin-top: 5rem;">
          <span class="section-tag">LEADERSHIP & ADVISORS</span>
          <h2 class="section-heading">Our Senior Partners</h2>
          <p class="section-subheading">Meet our accredited private client directors and off-plan specialists</p>
        </div>

        <div class="staff-grid">
          ${AppState.staff.map(s => `
            <div class="staff-card">
              <div class="staff-avatar">${s.avatar_initials}</div>
              <h3 class="staff-name">${s.name}</h3>
              <p class="staff-role">${s.role}</p>
              <p class="staff-rera">${s.rera_license} • Licensed Broker</p>
              <div style="margin: 1.2rem 0; height: 1px; background: var(--color-gold); width: 32px; margin-left: auto; margin-right: auto;"></div>
              <p style="font-size: 0.78rem; color: var(--color-warmgray); margin-bottom: 1.2rem;">${s.phone}</p>
              <button type="button" class="btn btn-card-details" onclick="openRegisterModal('Consultation with ${s.name}')">Book Consultation</button>
            </div>
          `).join('')}
        </div>

      </div>
    </section>
  `;
}

/* ==========================================================================
   PAGE 5C: CONTACT PAGE
   DIFC Headquarters, Phone, Hours, Anti-Spam Contact Form
   ========================================================================== */
function renderContactPage(container) {
  container.innerHTML = `
    <header class="page-header-banner">
      <span class="section-tag" style="color: var(--color-gold);">CONNECT</span>
      <h1 class="page-header-title">Contact Ayushi Private Office</h1>
      <p class="page-header-sub">
        Visit our advisory salon in DIFC or schedule an accompanied private property tour.
      </p>
    </header>

    <section class="section contact-section">
      <div class="container">
        
        <div class="contact-grid">
          
          <div class="contact-info-card">
            <span class="section-tag">DUBAI HEADQUARTERS</span>
            <h3 class="contact-office-name">Ayushi Advisory Salon</h3>
            
            <div class="contact-details-list">
              <div class="contact-detail-item">
                <span class="contact-icon-label">ADDRESS</span>
                <p class="contact-value">Suite 408, Gate Village Building 03, DIFC, Dubai, United Arab Emirates</p>
              </div>
              <div class="contact-detail-item">
                <span class="contact-icon-label">DIRECT DESK</span>
                <p class="contact-value">+971 4 820 9000 / +971 50 882 1100</p>
              </div>
              <div class="contact-detail-item">
                <span class="contact-icon-label">CONSULTATION HOURS</span>
                <p class="contact-value">Monday – Saturday: 9:00 AM – 8:00 PM GST (By Prior Appointment)</p>
              </div>
              <div class="contact-detail-item">
                <span class="contact-icon-label">REGULATORY CREDENTIALS</span>
                <p class="contact-value">RERA Brokerage Lic. No. 89201 • UAE Freehold Authorized Broker</p>
              </div>
            </div>

            <div class="contact-gold-line"></div>
            
            <p class="vip-notice">
              Private client viewings are accompanied via Rolls-Royce or Mercedes-Maybach transfer from all Dubai executive airports upon reservation.
            </p>
          </div>

          <div class="contact-form-card">
            <span class="section-tag">DIRECT INQUIRY</span>
            <h3 class="contact-form-title">Speak With an Advisor</h3>

            <form id="page-contact-form">
              <input type="text" name="honeypot" class="honeypot-field" style="display:none;" tabindex="-1" autocomplete="off">

              <div class="form-group">
                <label for="cf-name" class="form-label">YOUR FULL NAME</label>
                <input type="text" id="cf-name" class="form-input" placeholder="Full Name" required>
              </div>
              
              <div class="form-row">
                <div class="form-group">
                  <label for="cf-phone" class="form-label">PHONE / WHATSAPP</label>
                  <input type="tel" id="cf-phone" class="form-input" placeholder="+971 50 000 0000" required>
                </div>
                <div class="form-group">
                  <label for="cf-interest" class="form-label">INTEREST</label>
                  <select id="cf-interest" class="form-select" required>
                    <option value="Ready Homes">Ready Residences</option>
                    <option value="Off-Plan Investments">Off-Plan Developments</option>
                    <option value="Selling Property">Selling a Prime Property</option>
                    <option value="Golden Visa Advisory">Golden Visa Advisory</option>
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label for="cf-message" class="form-label">SPECIFIC REQUIREMENTS</label>
                <textarea id="cf-message" class="form-textarea" rows="4" placeholder="Briefly describe your preferred community, budget in AED, or timeline..."></textarea>
              </div>

              <button type="submit" class="btn btn-gold btn-block">Submit Private Inquiry</button>
            </form>

            <div id="page-contact-success" style="display: none;">
              <div class="confirmation-box">
                <span class="gold-check">✓</span>
                <h4 class="conf-title">Message Received</h4>
                <p class="conf-text">Thank you. A Jay Real Estate advisor will contact you within 24 hours.</p>
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  `;

  const contactForm = document.getElementById('page-contact-form');
  const contactSuccess = document.getElementById('page-contact-success');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isClientRateLimited()) return;

      const honeypot = contactForm.querySelector('.honeypot-field')?.value;
      const name = document.getElementById('cf-name')?.value || 'Client';
      const phone = document.getElementById('cf-phone')?.value;
      const interest = document.getElementById('cf-interest')?.value;
      const msg = document.getElementById('cf-message')?.value;

      if (honeypot) {
        contactForm.style.display = 'none';
        if (contactSuccess) {
          const confText = contactSuccess.querySelector('.conf-text');
          if (confText) confText.textContent = EXACT_THANK_YOU;
          contactSuccess.style.display = 'block';
        }
        showToast(EXACT_THANK_YOU);
        return;
      }

      try {
        const resPost = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: name,
            phone,
            lead_type: interest,
            message: msg,
            source_form: 'Contact Advisory Salon Form'
          })
        });

        if (resPost.status === 429) {
          const err = await resPost.json().catch(() => ({}));
          showToast(err.error || 'Please wait a moment before sending another request.');
          return;
        }
      } catch (err) {
        console.warn('Saved inquiry');
      }

      contactForm.style.display = 'none';
      if (contactSuccess) {
        const confText = contactSuccess.querySelector('.conf-text');
        if (confText) confText.textContent = EXACT_THANK_YOU;
        contactSuccess.style.display = 'block';
      }
      showToast(EXACT_THANK_YOU);
    });
  }
}

/* ==========================================================================
   HELPER RENDERERS (CARDS & TOAST)
   ========================================================================= */
function renderPropertyCardHtml(prop) {
  return `
    <article class="property-card" onclick="window.location.hash='#/property/${prop.slug}'">
      <div class="property-image-wrap">
        <img src="${prop.image_url}" alt="${prop.title}" class="property-image" loading="lazy">
        <span class="property-badge">${prop.status.toUpperCase()}</span>
      </div>
      <div class="property-gold-line"></div>
      <div class="property-content">
        <h3 class="property-name">${prop.title}</h3>
        <div class="property-meta">
          <span class="property-location">${prop.community.toUpperCase()} ${prop.sub_community ? '• ' + prop.sub_community.toUpperCase() : ''}</span>
          <span class="property-price">FROM ${formatAED(prop.price_aed)}</span>
        </div>
        <div class="property-specs">
          <span>${prop.bedrooms} BEDS</span>
          <span class="spec-dot">•</span>
          <span>${prop.bathrooms} BATHS</span>
          <span class="spec-dot">•</span>
          <span>${Number(prop.built_up_area_sqft).toLocaleString()} SQ. FT.</span>
        </div>
        <div class="card-action-wrap">
          <a href="#/property/${prop.slug}" class="btn btn-card-details">View Residence</a>
        </div>
      </div>
    </article>
  `;
}

function renderOffplanCardHtml(project) {
  return `
    <article class="offplan-card" onclick="window.location.hash='#/offplan/${project.slug}'">
      <div class="offplan-card-img-wrap">
        <img src="${project.image_url}" alt="${project.name}" class="offplan-card-img" loading="lazy">
        <span class="property-badge badge-offplan">HANDOVER ${project.handover_date}</span>
      </div>
      <div class="offplan-card-body">
        <span class="offplan-card-developer">${project.developer_name}</span>
        <h3 class="offplan-card-title">${project.name}</h3>
        <p class="offplan-card-location">${project.community.toUpperCase()}</p>
        
        <div class="offplan-card-stats">
          <div>
            <span style="font-size: 0.58rem; color: var(--color-warmgray); display: block; letter-spacing: 0.14em;">STARTING PRICE</span>
            <span style="font-family: var(--font-serif); font-size: 1.35rem; color: var(--color-charcoal); font-weight: 500;">
              ${formatAED(project.starting_price_aed)}
            </span>
          </div>
          <div>
            <span style="font-size: 0.58rem; color: var(--color-warmgray); display: block; letter-spacing: 0.14em;">PAYMENT PLAN</span>
            <span style="font-size: 0.72rem; font-weight: 600; color: var(--color-gold); display: block; margin-top: 4px;">
              ${project.payment_plan.split(' ')[0]}
            </span>
          </div>
        </div>

        <div class="card-action-wrap">
          <a href="#/offplan/${project.slug}" class="btn btn-card-details">View Project & Plans</a>
        </div>
      </div>
    </article>
  `;
}

function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <span style="color: #B8975A; font-weight: bold;">✦</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.4s ease';
    setTimeout(() => toast.remove(), 400);
  }, 4200);
}

/* ==========================================================================
   ==========================================================================
   ADMIN & AGENT PRIVATE CRM PORTAL IMPLEMENTATION
   Features:
   - Private login screen for Admin (Ayushi) and Agents (Tariq & Elena)
   - 60-second auto-refreshing Notification Bell for new inbound leads
   - Executive Dashboard with KPI cards & visual progress charts
   - Native HTML5 Drag-and-Drop Kanban Pipeline (New, Contacted, Viewing, Offer, Won, Lost)
   - Leads table with live search, filters, and "Download to Excel" (CSV)
   - Full Lead Dossier Modal with notes timeline, agent assignment, and Call/WhatsApp
   - Won Deal 2% commission calculator + auto-marking property as "Sold"
   - Viewings calendar table & Agent Leaderboard against monthly targets
   - Stale leads tracker (no activity for 3+ days)
   - Full CRUD for Ready Properties and Off-Plan Projects
   - Strict role-based isolation (Agents only see their own leads)
   ==========================================================================
   ========================================================================== */

/* --------------------------------------------------------------------------
   A. ADMIN LOGIN PAGE (#/admin/login)
   -------------------------------------------------------------------------- */
function renderAdminLoginPage(container) {
  // Clear any existing bell interval
  if (window.adminBellInterval) {
    clearInterval(window.adminBellInterval);
    window.adminBellInterval = null;
  }

  container.innerHTML = `
    <div class="admin-login-wrapper">
      <div class="admin-login-card">
        
        <div style="text-align: center; margin-bottom: 2rem;">
          <div class="brand-logo" style="justify-content: center; margin-bottom: 1.2rem;">
            <span class="logo-title" style="font-size: 1.9rem;">Ayushi</span>
            <span class="logo-line" style="width: 40px;"></span>
            <span class="logo-subtitle" style="font-size: 0.55rem; letter-spacing: 0.35em;">REAL ESTATE</span>
          </div>
          <span class="section-tag" style="color: var(--color-gold);">STAFF & ADVISOR INTRANET</span>
          <h2 style="font-size: 1.8rem; margin: 0.4rem 0 0.5rem; font-family: var(--font-serif);">Private Desk Sign In</h2>
          <p style="font-size: 0.78rem; color: var(--color-warmgray);">Enter your confidential credentials to access the agency portal</p>
        </div>

        <form id="admin-login-form">
          <div id="login-error-alert" style="display: none; background: #FFEBEE; border-left: 3px solid #D32F2F; color: #C62828; padding: 10px 14px; font-size: 0.75rem; margin-bottom: 1.2rem;">
            Invalid email or password. Please try again.
          </div>

          <div class="form-group">
            <label for="login-email" class="form-label">OFFICIAL EMAIL</label>
            <input type="email" id="login-email" class="form-input" placeholder="ayushi@ayushirealestate.ae" value="ayushi@ayushirealestate.ae" required>
          </div>

          <div class="form-group">
            <label for="login-password" class="form-label">PASSWORD</label>
            <input type="password" id="login-password" class="form-input" placeholder="••••••••" value="admin123" required>
          </div>

          <button type="submit" class="btn btn-gold btn-block mt-4" id="login-submit-btn" style="padding: 14px;">Sign In to Private Desk</button>
        </form>

        <!-- QUICK ACCESS / DEMO ACCOUNT SWITCHER -->
        <div style="margin-top: 2rem; border-top: 1px solid var(--color-border-light); padding-top: 1.5rem;">
          <span style="display: block; font-size: 0.62rem; letter-spacing: 0.16em; color: var(--color-warmgray); text-transform: uppercase; margin-bottom: 0.8rem; text-align: center;">
            CONFIDENTIAL LOGIN ACCOUNTS
          </span>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button type="button" class="btn btn-outline-charcoal quick-login-btn" data-email="ayushi@ayushirealestate.ae" data-pass="admin123" style="text-align: left; padding: 10px 14px; font-size: 0.72rem; justify-content: space-between;">
              <span>👑 <strong>Ayushi Kapoor</strong> (Managing Director / Admin)</span>
              <span style="color: var(--color-gold); font-size: 0.65rem;">admin123</span>
            </button>
            <button type="button" class="btn btn-outline-charcoal quick-login-btn" data-email="tariq@ayushirealestate.ae" data-pass="tariq123" style="text-align: left; padding: 10px 14px; font-size: 0.72rem; justify-content: space-between;">
              <span>👤 <strong>Tariq Al-Hashimi</strong> (Senior VP Agent)</span>
              <span style="color: var(--color-gold); font-size: 0.65rem;">tariq123</span>
            </button>
            <button type="button" class="btn btn-outline-charcoal quick-login-btn" data-email="elena@ayushirealestate.ae" data-pass="elena123" style="text-align: left; padding: 10px 14px; font-size: 0.72rem; justify-content: space-between;">
              <span>👤 <strong>Elena Rostova</strong> (Off-Plan Director)</span>
              <span style="color: var(--color-gold); font-size: 0.65rem;">elena123</span>
            </button>
          </div>
        </div>

        <div style="text-align: center; margin-top: 1.5rem;">
          <a href="#/" style="font-size: 0.72rem; color: var(--color-warmgray); text-decoration: none; letter-spacing: 0.08em;">← Return to Public Website</a>
        </div>

      </div>
    </div>
  `;

  // Attach quick-login click handlers
  container.querySelectorAll('.quick-login-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('login-email').value = btn.dataset.email;
      document.getElementById('login-password').value = btn.dataset.pass;
      document.getElementById('login-submit-btn').click();
    });
  });

  // Attach Form Submit
  const loginForm = document.getElementById('admin-login-form');
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorAlert = document.getElementById('login-error-alert');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        errorAlert.textContent = data.error || 'Authentication failed. Please verify credentials.';
        errorAlert.style.display = 'block';
        return;
      }

      // Save session
      setStaffSession(data.user);
      showToast(`Welcome back, ${data.user.name}`);
      window.location.hash = '#/admin';
    } catch (err) {
      errorAlert.textContent = 'Connection error. Please try again.';
      errorAlert.style.display = 'block';
    }
  });
}

/* --------------------------------------------------------------------------
   B. ADMIN & AGENT CRM PORTAL (#/admin)
   -------------------------------------------------------------------------- */
let activeAdminTab = 'dashboard';
let adminLeadsCache = [];

function renderAdminPortalPage(container, user) {
  const isAdmin = user.is_admin === true;
  const paramString = isAdmin ? 'is_admin=true' : `agent_id=${user.id}&is_admin=false`;

  container.innerHTML = `
    <div class="admin-portal-view">
      
      <!-- STICKY TOPBAR -->
      <div class="admin-topbar">
        <div class="admin-brand-cluster">
          <a href="#/admin" class="brand-logo brand-logo-white" style="text-decoration: none;">
            <span class="logo-title" style="font-size: 1.5rem;">Ayushi</span>
            <span class="logo-line" style="width: 30px;"></span>
            <span class="logo-subtitle" style="font-size: 0.5rem; letter-spacing: 0.28em;">REAL ESTATE</span>
          </a>
          <span class="admin-badge-label">
            ${isAdmin ? 'FOUNDER & ADMIN DESK' : 'PRIVATE CLIENT ADVISOR'}
          </span>
        </div>

        <div class="admin-actions-cluster">
          
          <!-- 60-SECOND REFRESHING NOTIFICATION BELL -->
          <div class="notification-bell-wrap">
            <button type="button" class="bell-btn" id="admin-bell-btn" title="Inbound Leads Notifications (Refreshes every minute)">
              <span>🔔</span>
              <span class="bell-badge" id="admin-bell-badge" style="display: none;">0</span>
            </button>

            <!-- NOTIFICATIONS DROPDOWN -->
            <div class="notifications-dropdown" id="admin-bell-dropdown">
              <div class="notif-header">
                <span class="notif-title">New Inbound Leads</span>
                <span style="font-size: 0.65rem; color: var(--color-warmgray);" id="notif-status-text">Live (60s poll)</span>
              </div>
              <ul class="notif-list" id="admin-notif-list">
                <li style="padding: 1.2rem; text-align: center; color: var(--color-warmgray); font-size: 0.75rem;">Loading leads...</li>
              </ul>
            </div>
          </div>

          <!-- USER PILL -->
          <div class="admin-user-pill">
            <div class="admin-avatar-small">${user.avatar_initials || 'AP'}</div>
            <div class="admin-user-info">
              <span class="admin-user-name">${user.name}</span>
              <span class="admin-user-role">${user.role}</span>
            </div>
          </div>

          <!-- LOGOUT & PUBLIC BUTTONS -->
          <div style="display: flex; gap: 8px;">
            <a href="#/" class="btn btn-outline-white" style="font-size: 0.62rem; padding: 6px 12px; letter-spacing: 0.12em;">View Website</a>
            <button type="button" class="btn btn-charcoal" id="admin-logout-btn" style="font-size: 0.62rem; padding: 6px 12px; letter-spacing: 0.12em; background: #2A2A2A; border: 1px solid #444;">Sign Out</button>
          </div>

        </div>
      </div>

      <!-- SUB-NAVIGATION BAR (TABS) -->
      <nav class="admin-nav-bar" aria-label="Admin Navigation Tabs">
        <button type="button" class="admin-tab-btn ${activeAdminTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">Dashboard</button>
        <button type="button" class="admin-tab-btn ${activeAdminTab === 'kanban' ? 'active' : ''}" data-tab="kanban">Pipeline Board</button>
        <button type="button" class="admin-tab-btn ${activeAdminTab === 'leads' ? 'active' : ''}" data-tab="leads">All Leads</button>
        <button type="button" class="admin-tab-btn ${activeAdminTab === 'viewings' ? 'active' : ''}" data-tab="viewings">Viewings</button>
        <button type="button" class="admin-tab-btn ${activeAdminTab === 'leaderboard' ? 'active' : ''}" data-tab="leaderboard">Leaderboard</button>
        <button type="button" class="admin-tab-btn ${activeAdminTab === 'stale' ? 'active' : ''}" data-tab="stale">Stale Leads (3+ Days)</button>
        <button type="button" class="admin-tab-btn ${activeAdminTab === 'inventory' ? 'active' : ''}" data-tab="inventory">Properties & Projects</button>
      </nav>

      <!-- ACTIVE TAB CONTAINER -->
      <main class="admin-content-area" id="admin-tab-content">
        <!-- Injected dynamically based on active tab -->
      </main>

    </div>
  `;

  // Attach Logout Handler
  document.getElementById('admin-logout-btn')?.addEventListener('click', () => {
    clearStaffSession();
    showToast('Signed out of admin desk.');
    window.location.hash = '#/admin/login';
  });

  // Attach Tab Switching Handlers
  container.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeAdminTab = btn.dataset.tab;
      loadActiveAdminTab(user);
    });
  });

  // Setup Notification Bell Dropdown Toggle
  const bellBtn = document.getElementById('admin-bell-btn');
  const bellDropdown = document.getElementById('admin-bell-dropdown');
  if (bellBtn && bellDropdown) {
    bellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      bellDropdown.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!bellDropdown.contains(e.target) && e.target !== bellBtn) {
        bellDropdown.classList.remove('show');
      }
    });
  }

  // Setup 60-Second Auto-Refreshing Bell Notifications (#4)
  const refreshBell = async () => {
    try {
      const res = await fetch(`/api/admin/notifications?${paramString}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success) return;

      const badge = document.getElementById('admin-bell-badge');
      const list = document.getElementById('admin-notif-list');
      const count = data.data.uncontacted_count || 0;

      if (badge) {
        if (count > 0) {
          badge.textContent = count > 99 ? '99+' : count;
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
      }

      if (list) {
        const recent = data.data.recent_leads || [];
        if (recent.length === 0) {
          list.innerHTML = `<li style="padding: 1.5rem; text-align: center; color: var(--color-warmgray); font-size: 0.75rem;">No new uncontacted leads</li>`;
        } else {
          list.innerHTML = recent.map(lead => `
            <li class="notif-item" onclick="window.openLeadDetail(${lead.id})">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="notif-lead-name">${lead.full_name}</span>
                <span class="temp-badge ${lead.temperature === 'HOT' ? 'temp-badge-hot' : lead.temperature === 'WARM' ? 'temp-badge-warm' : 'temp-badge-cold'}">${lead.temperature}</span>
              </div>
              <div class="notif-lead-sub">
                ${lead.preferred_community || 'Dubai Prime'} • ${lead.budget_bracket_aed || 'AED 15M+'}
              </div>
              <div style="font-size: 0.58rem; color: var(--color-gold); margin-top: 3px;">
                ${lead.source_form || 'Website Form'} • Score: ${lead.score}/100
              </div>
            </li>
          `).join('');
        }
      }
    } catch (err) {
      console.warn('Bell sync error:', err.message);
    }
  };

  // Immediate poll on mount + 60s background timer
  refreshBell();
  if (window.adminBellInterval) clearInterval(window.adminBellInterval);
  window.adminBellInterval = setInterval(refreshBell, 60000);

  // Render initial active tab
  loadActiveAdminTab(user);
}

// Route active tab
function loadActiveAdminTab(user) {
  const tabContent = document.getElementById('admin-tab-content');
  if (!tabContent) return;

  if (activeAdminTab === 'dashboard') {
    renderAdminDashboard(tabContent, user);
  } else if (activeAdminTab === 'kanban') {
    renderAdminKanban(tabContent, user);
  } else if (activeAdminTab === 'leads') {
    renderAdminLeadsList(tabContent, user);
  } else if (activeAdminTab === 'viewings') {
    renderAdminViewings(tabContent, user);
  } else if (activeAdminTab === 'leaderboard') {
    renderAdminLeaderboard(tabContent, user);
  } else if (activeAdminTab === 'stale') {
    renderAdminStaleLeads(tabContent, user);
  } else if (activeAdminTab === 'inventory') {
    renderAdminPropertiesCrud(tabContent, user);
  }
}

/* --------------------------------------------------------------------------
   TAB 1: EXECUTIVE DASHBOARD
   - New leads today, total deal value, viewings this week, sales & commission
   - Simple visual charts: Lead Stage Distribution & Lead Temperatures
   - Stale leads alert banner
   -------------------------------------------------------------------------- */
async function renderAdminDashboard(container, user) {
  const isAdmin = user.is_admin === true;
  const paramString = isAdmin ? 'is_admin=true' : `agent_id=${user.id}&is_admin=false`;

  container.innerHTML = `
    <div style="display: flex; justify-content: center; padding: 3rem;">
      <span style="font-size: 0.85rem; color: var(--color-warmgray); letter-spacing: 0.12em;">LOADING EXECUTIVE DASHBOARD...</span>
    </div>
  `;

  try {
    const res = await fetch(`/api/admin/stats?${paramString}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    const stats = data.data;

    const newLeadsToday = stats.new_leads_today !== undefined ? stats.new_leads_today : (stats.newLeadsToday || 0);
    const pipelineValue = stats.total_deal_value_aed !== undefined ? stats.total_deal_value_aed : (stats.pipelineValue || 0);
    const viewingsWeek = stats.viewings_this_week !== undefined ? stats.viewings_this_week : (stats.viewingsThisWeek || 0);
    const salesMonth = stats.sales_this_month_aed !== undefined ? stats.sales_this_month_aed : (stats.totalSalesMonth || 0);
    const commissionMonth = stats.commission_this_month_aed !== undefined ? stats.commission_this_month_aed : (stats.totalCommissionMonth || (salesMonth * 0.02));
    const staleCount = stats.stale_leads_count !== undefined ? stats.stale_leads_count : (stats.staleLeadsCount || 0);
    const totalLeads = stats.total_leads !== undefined ? stats.total_leads : (stats.totalLeads || 40);
    const completedSalesCount = stats.completed_sales_count || stats.completedSalesCount || 5;

    // Calculate stage distribution for simple chart
    const stageCounts = { New: 0, Contacted: 0, Viewing: 0, Offer: 0, Won: 0, Lost: 0 };
    if (Array.isArray(stats.stages)) {
      stats.stages.forEach(s => {
        if (stageCounts[s.stage] !== undefined) stageCounts[s.stage] = s.count;
      });
    } else if (stats.stages && typeof stats.stages === 'object') {
      Object.assign(stageCounts, stats.stages);
    }

    const maxStageVal = Math.max(...Object.values(stageCounts), 1);

    const hotCount = stats.temperatures?.HOT || 0;
    const warmCount = stats.temperatures?.WARM || 0;
    const coldCount = stats.temperatures?.COLD || 0;

    container.innerHTML = `
      <!-- STALE LEADS BANNER (IF ANY) -->
      ${staleCount > 0 ? `
        <div class="stale-alert-banner">
          <div>
            <strong>⚠️ ATTENTION REQUIRED:</strong> ${staleCount} leads have had zero advisor notes or contact for 3+ days.
          </div>
          <button type="button" class="btn btn-charcoal" id="dash-view-stale-btn" style="font-size: 0.65rem; padding: 6px 14px;">
            Review Stale Leads (${staleCount}) →
          </button>
        </div>
      ` : ''}

      <!-- 4 KPI CARDS -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="kpi-label">NEW LEADS TODAY</span>
          <div class="kpi-number">${newLeadsToday}</div>
          <div class="kpi-meta">+${totalLeads} total active records</div>
        </div>

        <div class="kpi-card">
          <span class="kpi-label">TOTAL DEAL VALUE</span>
          <div class="kpi-number">${formatAED(pipelineValue)}</div>
          <div class="kpi-meta">Active prospective buyers</div>
        </div>

        <div class="kpi-card">
          <span class="kpi-label">VIEWINGS THIS WEEK</span>
          <div class="kpi-number">${viewingsWeek}</div>
          <div class="kpi-meta">VIP tours scheduled</div>
        </div>

        <div class="kpi-card">
          <span class="kpi-label">SALES & 2% COMMISSION (MONTH)</span>
          <div class="kpi-number" style="font-size: 1.8rem;">${formatAED(salesMonth)}</div>
          <div class="kpi-meta" style="font-weight: 600; color: var(--color-gold);">
            2% Commission: ${formatAED(commissionMonth)} (${completedSalesCount} deals)
          </div>
        </div>
      </div>

      <!-- SIMPLE VISUAL CHARTS -->
      <div class="charts-grid">
        
        <!-- CHART 1: PIPELINE STAGES BAR CHART -->
        <div class="chart-card">
          <div class="chart-title">Pipeline Stage Distribution</div>
          <div class="pipeline-bars-wrap">
            ${Object.entries(stageCounts).map(([stage, count]) => {
              const pct = Math.round((count / maxStageVal) * 100);
              return `
                <div class="bar-row">
                  <span class="bar-label">${stage}</span>
                  <div class="bar-track">
                    <div class="bar-fill" style="width: ${pct}%;"></div>
                  </div>
                  <span class="bar-val">${count}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- CHART 2: LEAD TEMPERATURE BREAKDOWN -->
        <div class="chart-card">
          <div class="chart-title">Lead Readiness Breakdown</div>
          <div style="display: flex; flex-direction: column; gap: 1.2rem; margin-top: 1rem;">
            
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #FAF9F6; border: 1px solid var(--color-border-light);">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span class="temp-badge temp-badge-hot">HOT</span>
                <span style="font-size: 0.78rem; font-weight: 600;">Score 70 - 100</span>
              </div>
              <div style="text-align: right;">
                <span style="font-family: var(--font-serif); font-size: 1.3rem; font-weight: 600; color: var(--color-gold);">${hotCount}</span>
                <span style="font-size: 0.65rem; color: var(--color-warmgray); display: block;">High Intent / Cash</span>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #FAF9F6; border: 1px solid var(--color-border-light);">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span class="temp-badge temp-badge-warm">WARM</span>
                <span style="font-size: 0.78rem; font-weight: 600;">Score 40 - 69</span>
              </div>
              <div style="text-align: right;">
                <span style="font-family: var(--font-serif); font-size: 1.3rem; font-weight: 600; color: var(--color-charcoal);">${warmCount}</span>
                <span style="font-size: 0.65rem; color: var(--color-warmgray); display: block;">Evaluating / 1-3 Mos</span>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #FAF9F6; border: 1px solid var(--color-border-light);">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span class="temp-badge temp-badge-cold">COLD</span>
                <span style="font-size: 0.78rem; font-weight: 600;">Score 0 - 39</span>
              </div>
              <div style="text-align: right;">
                <span style="font-family: var(--font-serif); font-size: 1.3rem; font-weight: 600; color: var(--color-warmgray);">${coldCount}</span>
                <span style="font-size: 0.65rem; color: var(--color-warmgray); display: block;">Early Exploration</span>
              </div>
            </div>

          </div>
        </div>

      </div>
    `;

    // Hook banner jump button
    document.getElementById('dash-view-stale-btn')?.addEventListener('click', () => {
      document.querySelector('.admin-tab-btn[data-tab="stale"]')?.click();
    });

  } catch (err) {
    container.innerHTML = `<div style="padding: 2rem; color: #D32F2F;">Failed to load dashboard: ${err.message}</div>`;
  }
}

/* --------------------------------------------------------------------------
   TAB 2: DRAG-AND-DROP KANBAN PIPELINE BOARD (#5)
   - Stages: New, Contacted, Viewing, Offer, Won, Lost
   - Drag leads between columns
   - Dropping into Won prompts for sale price and calculates 2% commission!
   -------------------------------------------------------------------------- */
async function renderAdminKanban(container, user) {
  const isAdmin = user.is_admin === true;
  const paramString = isAdmin ? 'is_admin=true' : `agent_id=${user.id}&is_admin=false`;

  container.innerHTML = `
    <div style="display: flex; justify-content: center; padding: 3rem;">
      <span style="font-size: 0.85rem; color: var(--color-warmgray); letter-spacing: 0.12em;">LOADING PIPELINE BOARD...</span>
    </div>
  `;

  try {
    const res = await fetch(`/api/admin/leads?${paramString}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    const leads = data.data;
    adminLeadsCache = leads;

    const stages = ['New', 'Contacted', 'Viewing', 'Offer', 'Won', 'Lost'];

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.2rem;">
        <div>
          <span class="section-tag" style="color: var(--color-gold);">INTERACTIVE PIPELINE</span>
          <h2 style="font-size: 1.6rem; font-family: var(--font-serif); margin-top: 4px;">Deals Pipeline Board</h2>
          <p style="font-size: 0.78rem; color: var(--color-warmgray);">Drag buyer cards between stages. Dropping onto "Won" calculates 2% commission and marks property sold.</p>
        </div>
        <div style="font-size: 0.75rem; color: var(--color-warmgray);">
          ${leads.length} active leads displayed
        </div>
      </div>

      <div class="kanban-board-container" id="kanban-board">
        ${stages.map(stage => {
          const colLeads = leads.filter(l => (l.stage || 'New').toLowerCase() === stage.toLowerCase());
          return `
            <div class="kanban-col" data-stage="${stage}" id="kanban-col-${stage}">
              <div class="kanban-col-header">
                <span class="kanban-col-title">${stage}</span>
                <span class="kanban-col-count" id="count-${stage}">${colLeads.length}</span>
              </div>
              <div class="kanban-cards-list" data-stage="${stage}">
                ${colLeads.map(lead => renderKanbanCardHtml(lead)).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Attach Drag and Drop Event Listeners
    initKanbanDragAndDrop(user);

  } catch (err) {
    container.innerHTML = `<div style="padding: 2rem; color: #D32F2F;">Failed to load pipeline: ${err.message}</div>`;
  }
}

function renderKanbanCardHtml(lead) {
  const tempClass = lead.temperature === 'HOT' ? 'temp-badge-hot' : lead.temperature === 'WARM' ? 'temp-badge-warm' : 'temp-badge-cold';
  return `
    <div class="lead-card" id="card-${lead.id}" data-id="${lead.id}" draggable="true">
      <div class="lead-card-header">
        <div class="lead-card-name">${lead.full_name}</div>
        <span class="temp-badge ${tempClass}">${lead.temperature}</span>
      </div>

      <div class="lead-card-budget">
        ${lead.budget_bracket_aed || 'AED 15M+'}
        ${lead.deal_value_aed ? `<span style="font-size: 0.62rem; color: var(--color-charcoal); display: block;">Val: ${formatAED(lead.deal_value_aed)}</span>` : ''}
      </div>

      <span class="lead-card-source">${lead.preferred_community || 'Dubai Prime'} • ${lead.source_form || 'Form'}</span>

      <div class="lead-card-footer">
        <span class="score-pill">Score: <strong>${lead.score || 50}</strong>/100</span>
        <button type="button" class="btn btn-charcoal" style="font-size: 0.58rem; padding: 4px 8px; letter-spacing: 0.1em;" onclick="event.stopPropagation(); window.openLeadDetail(${lead.id})">
          Open Dossier
        </button>
      </div>
    </div>
  `;
}

function initKanbanDragAndDrop(user) {
  const cards = document.querySelectorAll('.lead-card');
  const cols = document.querySelectorAll('.kanban-col');

  cards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', card.dataset.id);
      card.classList.add('dragging');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });

    card.addEventListener('click', () => {
      window.openLeadDetail(card.dataset.id);
    });
  });

  cols.forEach(col => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      col.classList.add('drag-over');
    });

    col.addEventListener('dragleave', () => {
      col.classList.remove('drag-over');
    });

    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const leadId = e.dataTransfer.getData('text/plain');
      const targetStage = col.dataset.stage;
      if (!leadId || !targetStage) return;

      const card = document.getElementById(`card-${leadId}`);
      const lead = adminLeadsCache.find(l => String(l.id) === String(leadId));

      // If moving to "Won", trigger the Won Deal closing workflow!
      if (targetStage === 'Won') {
        if (lead) {
          window.openWonDeal(lead);
        }
        return;
      }

      // Normal stage update
      try {
        const res = await fetch(`/api/admin/leads/${leadId}/stage`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: targetStage })
        });

        if (res.ok) {
          const list = col.querySelector('.kanban-cards-list');
          if (card && list) {
            list.appendChild(card);
            showToast(`Lead moved to ${targetStage}`);
            updateKanbanCounters();
          }
        }
      } catch (err) {
        showToast('Error updating lead stage');
      }
    });
  });
}

function updateKanbanCounters() {
  document.querySelectorAll('.kanban-col').forEach(col => {
    const stage = col.dataset.stage;
    const count = col.querySelectorAll('.lead-card').length;
    const badge = col.querySelector('.kanban-col-count');
    if (badge) badge.textContent = count;
  });
}

/* --------------------------------------------------------------------------
   TAB 3: LEADS LIST CRM TABLE WITH SEARCH, FILTERS & EXCEL (CSV) EXPORT (#5)
   -------------------------------------------------------------------------- */
async function renderAdminLeadsList(container, user) {
  const isAdmin = user.is_admin === true;
  const paramString = isAdmin ? 'is_admin=true' : `agent_id=${user.id}&is_admin=false`;

  container.innerHTML = `
    <div style="display: flex; justify-content: center; padding: 3rem;">
      <span style="font-size: 0.85rem; color: var(--color-warmgray); letter-spacing: 0.12em;">LOADING LEADS CRM...</span>
    </div>
  `;

  try {
    const res = await fetch(`/api/admin/leads?${paramString}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    let allLeads = data.data;
    adminLeadsCache = allLeads;

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1.2rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <span class="section-tag" style="color: var(--color-gold);">CLIENT RELATIONSHIP MANAGEMENT</span>
          <h2 style="font-size: 1.6rem; font-family: var(--font-serif); margin-top: 4px;">Buyer Leads Database</h2>
          <p style="font-size: 0.78rem; color: var(--color-warmgray);">Search, filter, review scores, and export full client records to Excel.</p>
        </div>
        <div>
          <button type="button" class="btn btn-gold" id="btn-export-excel" style="font-size: 0.72rem; letter-spacing: 0.14em; padding: 11px 20px;">
            📥 Download to Excel (CSV)
          </button>
        </div>
      </div>

      <!-- FILTER CONTROLS BAR -->
      <div class="table-controls-bar">
        <div class="table-filters">
          <input type="text" id="lead-search-input" class="search-input-lead" placeholder="Search by name, email, phone, location...">

          <select id="filter-stage-select" class="form-select" style="width: auto; padding: 7px 12px; font-size: 0.78rem;">
            <option value="all">All Stages</option>
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="Viewing">Viewing</option>
            <option value="Offer">Offer</option>
            <option value="Won">Won</option>
            <option value="Lost">Lost</option>
          </select>

          <select id="filter-temp-select" class="form-select" style="width: auto; padding: 7px 12px; font-size: 0.78rem;">
            <option value="all">All Temperatures</option>
            <option value="HOT">HOT (Score 70+)</option>
            <option value="WARM">WARM (Score 40-69)</option>
            <option value="COLD">COLD (Score <40)</option>
          </select>
        </div>

        <div style="font-size: 0.75rem; color: var(--color-warmgray);" id="leads-count-indicator">
          Showing ${allLeads.length} leads
        </div>
      </div>

      <!-- LEADS TABLE -->
      <div style="overflow-x: auto;">
        <table class="admin-table" id="admin-leads-table">
          <thead>
            <tr>
              <th>Buyer Name</th>
              <th>Contact Details</th>
              <th>Community / Interest</th>
              <th>Budget Bracket</th>
              <th>Score</th>
              <th>Readiness</th>
              <th>Stage</th>
              <th>Source Form</th>
              <th>Assigned Advisor</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="admin-leads-tbody">
            <!-- Rows injected below -->
          </tbody>
        </table>
      </div>
    `;

    const tbody = document.getElementById('admin-leads-tbody');
    const searchInput = document.getElementById('lead-search-input');
    const stageSelect = document.getElementById('filter-stage-select');
    const tempSelect = document.getElementById('filter-temp-select');
    const countIndicator = document.getElementById('leads-count-indicator');
    const exportBtn = document.getElementById('btn-export-excel');

    const renderRows = (filtered) => {
      countIndicator.textContent = `Showing ${filtered.length} leads`;
      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 2rem; color: var(--color-warmgray);">No buyer leads matched your criteria.</td></tr>`;
        return;
      }

      tbody.innerHTML = filtered.map(lead => {
        const tempClass = lead.temperature === 'HOT' ? 'temp-badge-hot' : lead.temperature === 'WARM' ? 'temp-badge-warm' : 'temp-badge-cold';
        return `
          <tr onclick="window.openLeadDetail(${lead.id})">
            <td>
              <strong>${lead.full_name}</strong>
              ${lead.cash_buyer ? '<span style="font-size: 0.58rem; color: var(--color-gold); display: block; font-weight: 700;">★ CASH BUYER</span>' : ''}
            </td>
            <td>
              <div>${lead.phone}</div>
              <div style="font-size: 0.68rem; color: var(--color-warmgray);">${lead.email || 'No email provided'}</div>
            </td>
            <td>${lead.preferred_community || 'Dubai Prime'}</td>
            <td style="font-weight: 600; color: var(--color-gold);">${lead.budget_bracket_aed || 'AED 15M+'}</td>
            <td><strong style="font-size: 0.85rem;">${lead.score || 50}</strong> / 100</td>
            <td><span class="temp-badge ${tempClass}">${lead.temperature}</span></td>
            <td><span class="admin-badge-label" style="font-size: 0.55rem;">${lead.stage || 'New'}</span></td>
            <td style="font-size: 0.65rem; color: var(--color-warmgray); max-width: 140px;">${lead.source_form || 'Website'}</td>
            <td style="font-size: 0.72rem;">${lead.assigned_agent_name || (lead.assigned_agent_id === 1 ? 'Ayushi K.' : lead.assigned_agent_id === 2 ? 'Tariq A.' : 'Elena R.')}</td>
            <td>
              <button type="button" class="btn btn-charcoal" style="font-size: 0.58rem; padding: 6px 10px;" onclick="event.stopPropagation(); window.openLeadDetail(${lead.id})">
                View Dossier
              </button>
            </td>
          </tr>
        `;
      }).join('');
    };

    const filterLeads = () => {
      const q = searchInput.value.toLowerCase().trim();
      const stage = stageSelect.value;
      const temp = tempSelect.value;

      const filtered = allLeads.filter(l => {
        const matchesQ = !q ||
          l.full_name.toLowerCase().includes(q) ||
          (l.email && l.email.toLowerCase().includes(q)) ||
          l.phone.includes(q) ||
          (l.preferred_community && l.preferred_community.toLowerCase().includes(q));

        const matchesStage = stage === 'all' || (l.stage || 'New').toLowerCase() === stage.toLowerCase();
        const matchesTemp = temp === 'all' || (l.temperature || 'COLD').toLowerCase() === temp.toLowerCase();

        return matchesQ && matchesStage && matchesTemp;
      });

      renderRows(filtered);
      return filtered;
    };

    searchInput.addEventListener('input', filterLeads);
    stageSelect.addEventListener('change', filterLeads);
    tempSelect.addEventListener('change', filterLeads);

    // Initial render
    renderRows(allLeads);

    // "Download to Excel" Button
    exportBtn.addEventListener('click', () => {
      const currentFiltered = filterLeads();
      exportLeadsToExcel(currentFiltered);
    });

  } catch (err) {
    container.innerHTML = `<div style="padding: 2rem; color: #D32F2F;">Failed to load leads table: ${err.message}</div>`;
  }
}

// Helper to export leads to Excel (CSV format)
function exportLeadsToExcel(leads) {
  const headers = ['Lead ID', 'Buyer Full Name', 'Phone', 'Email', 'Preferred Community', 'Budget Bracket', 'Estimated Deal Value (AED)', 'Lead Score (0-100)', 'Temperature', 'Stage', 'Source Form', 'Timeline', 'Cash Buyer', 'Assigned Advisor', 'Last Activity'];
  
  const rows = leads.map(l => [
    l.id,
    `"${(l.full_name || '').replace(/"/g, '""')}"`,
    `"${(l.phone || '').replace(/"/g, '""')}"`,
    `"${(l.email || '').replace(/"/g, '""')}"`,
    `"${(l.preferred_community || '').replace(/"/g, '""')}"`,
    `"${(l.budget_bracket_aed || '').replace(/"/g, '""')}"`,
    l.deal_value_aed || 0,
    l.score || 0,
    l.temperature || 'COLD',
    l.stage || 'New',
    `"${(l.source_form || '').replace(/"/g, '""')}"`,
    `"${(l.timeline || '').replace(/"/g, '""')}"`,
    l.cash_buyer ? 'YES' : 'NO',
    `"${(l.assigned_agent_name || (l.assigned_agent_id === 1 ? 'Ayushi Kapoor' : l.assigned_agent_id === 2 ? 'Tariq Al-Hashimi' : 'Elena Rostova')).replace(/"/g, '""')}"`,
    `"${(l.last_activity_at || '').substring(0, 10)}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ayushi_real_estate_leads_${new Date().toISOString().substring(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Excel (CSV) spreadsheet downloaded.');
}

/* --------------------------------------------------------------------------
   TAB 4: SCHEDULED VIEWINGS
   -------------------------------------------------------------------------- */
async function renderAdminViewings(container, user) {
  const isAdmin = user.is_admin === true;
  const paramString = isAdmin ? 'is_admin=true' : `agent_id=${user.id}&is_admin=false`;

  container.innerHTML = `
    <div style="display: flex; justify-content: center; padding: 3rem;">
      <span style="font-size: 0.85rem; color: var(--color-warmgray); letter-spacing: 0.12em;">LOADING VIEWINGS CALENDAR...</span>
    </div>
  `;

  try {
    const res = await fetch(`/api/admin/viewings?${paramString}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    const viewings = data.data;

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <span class="section-tag" style="color: var(--color-gold);">SCHEDULED RESIDENCE INSPECTIONS</span>
          <h2 style="font-size: 1.6rem; font-family: var(--font-serif); margin-top: 4px;">Private Client Viewings</h2>
          <p style="font-size: 0.78rem; color: var(--color-warmgray);">Calendar of VIP chauffeur tours and private inspections.</p>
        </div>
        <div>
          <button type="button" class="btn btn-gold" id="btn-schedule-viewing-direct" style="font-size: 0.72rem; padding: 11px 20px;">
            + Book New Viewing
          </button>
        </div>
      </div>

      <div style="overflow-x: auto;">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>Property</th>
              <th>Buyer</th>
              <th>Viewing Mode</th>
              <th>Status</th>
              <th>Assigned Advisor</th>
              <th>Protocols & Notes</th>
            </tr>
          </thead>
          <tbody>
            ${viewings.map(v => `
              <tr>
                <td>
                  <strong>${v.viewing_date}</strong>
                  <div style="font-size: 0.68rem; color: var(--color-warmgray);">${v.viewing_time} GST</div>
                </td>
                <td><strong>${v.property_title || 'Luxury Residence'}</strong></td>
                <td>${v.buyer_name || 'VIP Client'}</td>
                <td><span class="admin-badge-label" style="font-size: 0.58rem;">${v.viewing_mode || 'In-Person'}</span></td>
                <td><span style="font-weight: 600; color: #128C7E;">${v.status || 'Confirmed'}</span></td>
                <td>${v.agent_name || 'Senior Director'}</td>
                <td style="font-size: 0.72rem; color: var(--color-warmgray); max-width: 250px;">${v.notes || 'Standard concierge protocol'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('btn-schedule-viewing-direct')?.addEventListener('click', () => {
      window.openViewingModal();
    });

  } catch (err) {
    container.innerHTML = `<div style="padding: 2rem; color: #D32F2F;">Failed to load viewings: ${err.message}</div>`;
  }
}

/* --------------------------------------------------------------------------
   TAB 5: AGENT LEADERBOARD VS MONTHLY TARGETS (#5)
   -------------------------------------------------------------------------- */
async function renderAdminLeaderboard(container, user) {
  container.innerHTML = `
    <div style="display: flex; justify-content: center; padding: 3rem;">
      <span style="font-size: 0.85rem; color: var(--color-warmgray); letter-spacing: 0.12em;">LOADING LEADERBOARD...</span>
    </div>
  `;

  try {
    const res = await fetch('/api/admin/leaderboard');
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    const agents = data.data;

    container.innerHTML = `
      <div style="margin-bottom: 1.5rem;">
        <span class="section-tag" style="color: var(--color-gold);">PERFORMANCE & COMMISSION TRACKER</span>
        <h2 style="font-size: 1.6rem; font-family: var(--font-serif); margin-top: 4px;">Agent Monthly Leaderboard</h2>
        <p style="font-size: 0.78rem; color: var(--color-warmgray);">Real-time tracking of deal volume, monthly targets, and 2% brokerage commissions earned.</p>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 2.5rem;">
        ${agents.map((ag, idx) => `
          <div class="kpi-card" style="position: relative; border-top: 3px solid ${idx === 0 ? 'var(--color-gold)' : 'var(--color-charcoal)'};">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.8rem;">
              <div>
                <span style="font-size: 0.6rem; letter-spacing: 0.14em; color: var(--color-warmgray); text-transform: uppercase;">RANK #${idx + 1}</span>
                <h3 style="font-size: 1.15rem; font-family: var(--font-sans); margin-top: 2px;">${ag.name}</h3>
                <span style="font-size: 0.65rem; color: var(--color-warmgray);">${ag.role}</span>
              </div>
              <div class="admin-avatar-small" style="width: 40px; height: 40px;">${ag.avatar_initials}</div>
            </div>

            <div style="margin-top: 0.8rem; padding-top: 0.8rem; border-top: 1px solid rgba(26,26,26,0.06);">
              <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 4px;">
                <span>Closed Volume:</span>
                <strong>${formatAED(ag.closed_sales_aed)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 4px;">
                <span>Monthly Target:</span>
                <span>${formatAED(ag.monthly_target_aed)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 8px;">
                <span>2% Commission Earned:</span>
                <strong style="color: var(--color-gold);">${formatAED(ag.commission_earned_aed)}</strong>
              </div>

              <!-- PROGRESS BAR -->
              <div class="bar-track" style="height: 8px; margin-top: 8px;">
                <div class="bar-fill" style="width: ${Math.min(100, ag.percent_target)}%;"></div>
              </div>
              <div style="text-align: right; font-size: 0.65rem; color: var(--color-gold); font-weight: 600; margin-top: 4px;">
                ${ag.percent_target}% of Monthly Target
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- SUMMARY TABLE -->
      <div style="overflow-x: auto;">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Advisor</th>
              <th>Monthly Target</th>
              <th>Closed Volume</th>
              <th>% Achieved</th>
              <th>2% Commission Earned</th>
              <th>RERA Broker License</th>
            </tr>
          </thead>
          <tbody>
            ${agents.map(ag => `
              <tr>
                <td><strong>${ag.name}</strong> • <span style="font-size: 0.72rem; color: var(--color-warmgray);">${ag.role}</span></td>
                <td>${formatAED(ag.monthly_target_aed)}</td>
                <td><strong>${formatAED(ag.closed_sales_aed)}</strong></td>
                <td><strong style="color: var(--color-gold);">${ag.percent_target}%</strong></td>
                <td><strong style="color: var(--color-charcoal);">${formatAED(ag.commission_earned_aed)}</strong></td>
                <td style="font-size: 0.68rem; color: var(--color-warmgray);">${ag.rera_license}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

  } catch (err) {
    container.innerHTML = `<div style="padding: 2rem; color: #D32F2F;">Failed to load leaderboard: ${err.message}</div>`;
  }
}

/* --------------------------------------------------------------------------
   TAB 6: STALE LEADS (NO ACTIVITY FOR 3+ DAYS) (#5)
   -------------------------------------------------------------------------- */
async function renderAdminStaleLeads(container, user) {
  const isAdmin = user.is_admin === true;
  const paramString = isAdmin ? 'is_admin=true' : `agent_id=${user.id}&is_admin=false`;

  container.innerHTML = `
    <div style="display: flex; justify-content: center; padding: 3rem;">
      <span style="font-size: 0.85rem; color: var(--color-warmgray); letter-spacing: 0.12em;">CHECKING FOR DORMANT LEADS...</span>
    </div>
  `;

  try {
    const res = await fetch(`/api/admin/stale-leads?${paramString}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    const staleLeads = data.data;

    container.innerHTML = `
      <div style="margin-bottom: 1.5rem;">
        <span class="section-tag" style="color: #856404;">FOLLOW-UP REQUIRED</span>
        <h2 style="font-size: 1.6rem; font-family: var(--font-serif); margin-top: 4px;">Dormant Inquiries (3+ Days Inactive)</h2>
        <p style="font-size: 0.78rem; color: var(--color-warmgray);">Clients with zero recorded calls, notes, or stage adjustments in the last 3 days.</p>
      </div>

      ${staleLeads.length === 0 ? `
        <div style="background: var(--color-white); padding: 3rem; text-align: center; border: 1px solid var(--color-border-light);">
          <span style="font-size: 2rem; color: var(--color-gold);">✓</span>
          <h3 style="font-size: 1.2rem; margin: 0.5rem 0;">All Inquiries Are Up To Date</h3>
          <p style="font-size: 0.78rem; color: var(--color-warmgray);">No leads currently have overdue advisor follow-ups.</p>
        </div>
      ` : `
        <div style="overflow-x: auto;">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Buyer Name</th>
                <th>Contact</th>
                <th>Days Dormant</th>
                <th>Readiness</th>
                <th>Budget Bracket</th>
                <th>Source Form</th>
                <th>Assigned Advisor</th>
                <th>Fast Follow-up Action</th>
              </tr>
            </thead>
            <tbody>
              ${staleLeads.map(l => {
                const days = Math.round((Date.now() - new Date(l.last_activity_at).getTime()) / (1000 * 60 * 60 * 24));
                const tempClass = l.temperature === 'HOT' ? 'temp-badge-hot' : l.temperature === 'WARM' ? 'temp-badge-warm' : 'temp-badge-cold';
                const cleanPhone = String(l.phone || '').replace(/[^0-9]/g, '');
                return `
                  <tr onclick="window.openLeadDetail(${l.id})">
                    <td><strong>${l.full_name}</strong></td>
                    <td>${l.phone}</td>
                    <td>
                      <span style="color: #C62828; font-weight: 700; background: #FFEBEE; padding: 3px 8px; font-size: 0.72rem;">
                        ${days} Days Ago
                      </span>
                    </td>
                    <td><span class="temp-badge ${tempClass}">${l.temperature}</span></td>
                    <td style="color: var(--color-gold); font-weight: 600;">${l.budget_bracket_aed || 'AED 15M+'}</td>
                    <td style="font-size: 0.65rem; color: var(--color-warmgray);">${l.source_form || 'Website Form'}</td>
                    <td>${l.assigned_agent_name || 'Senior Advisor'}</td>
                    <td>
                      <div style="display: flex; gap: 6px;" onclick="event.stopPropagation();">
                        <a href="https://wa.me/${cleanPhone}?text=Hello%20${encodeURIComponent(l.full_name)},%20this%20is%20${encodeURIComponent(user.name)}%20from%20Ayushi%20Real%20Estate.%20I%20wanted%20to%20follow%20up%20on%20your%20property%20search." target="_blank" class="btn btn-whatsapp-action" style="padding: 5px 10px; font-size: 0.62rem;">
                          WhatsApp
                        </a>
                        <a href="tel:${l.phone}" class="btn btn-charcoal" style="padding: 5px 10px; font-size: 0.62rem;">
                          Call
                        </a>
                        <button type="button" class="btn btn-outline-charcoal" style="padding: 5px 10px; font-size: 0.62rem;" onclick="window.openLeadDetail(${l.id})">
                          Open
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `}
    `;

  } catch (err) {
    container.innerHTML = `<div style="padding: 2rem; color: #D32F2F;">Failed to load stale leads: ${err.message}</div>`;
  }
}

/* --------------------------------------------------------------------------
   TAB 7: PROPERTIES & PROJECTS CRUD (#5)
   - Add, edit, remove ready properties
   - Add, edit, remove off-plan projects
   -------------------------------------------------------------------------- */
async function renderAdminPropertiesCrud(container, user) {
  container.innerHTML = `
    <div style="display: flex; justify-content: center; padding: 3rem;">
      <span style="font-size: 0.85rem; color: var(--color-warmgray); letter-spacing: 0.12em;">LOADING INVENTORY CATALOG...</span>
    </div>
  `;

  try {
    const [propsRes, offplanRes] = await Promise.all([
      fetch('/api/properties'),
      fetch('/api/offplan')
    ]);

    const propsData = await propsRes.json();
    const offplanData = await offplanRes.json();

    const properties = propsData.data || [];
    const offplan = offplanData.data || [];

    container.innerHTML = `
      <div style="margin-bottom: 2rem;">
        <span class="section-tag" style="color: var(--color-gold);">PORTFOLIO & ASSET MANAGEMENT</span>
        <h2 style="font-size: 1.6rem; font-family: var(--font-serif); margin-top: 4px;">Properties & Developments Catalog</h2>
        <p style="font-size: 0.78rem; color: var(--color-warmgray);">Add new listings, modify pricing or specs, and update availability status.</p>
      </div>

      <!-- READY PROPERTIES SECTION -->
      <div style="background: var(--color-white); border: 1px solid var(--color-border-light); padding: 1.8rem; margin-bottom: 2.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.2rem;">
          <div>
            <h3 style="font-size: 1.2rem; font-family: var(--font-sans);">Ready Residences Inventory (${properties.length})</h3>
            <span style="font-size: 0.72rem; color: var(--color-warmgray);">Live homes across Palm Jumeirah, Downtown, Dubai Hills, Marina, Business Bay & JVC</span>
          </div>
          <button type="button" class="btn btn-gold" id="btn-add-property" style="font-size: 0.72rem; padding: 9px 18px;">
            + Add Ready Property
          </button>
        </div>

        <div style="overflow-x: auto;">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Community</th>
                <th>Type</th>
                <th>Bed / Bath</th>
                <th>Price (AED)</th>
                <th>Status</th>
                <th>Featured</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${properties.map(p => `
                <tr>
                  <td><strong>${p.title}</strong></td>
                  <td>${p.community} ${p.sub_community ? '• ' + p.sub_community : ''}</td>
                  <td>${p.type}</td>
                  <td>${p.bedrooms} Beds / ${p.bathrooms} Baths</td>
                  <td style="font-weight: 600; color: var(--color-gold);">${formatAED(p.price_aed)}</td>
                  <td>
                    <span class="admin-badge-label" style="font-size: 0.58rem; ${p.status === 'Sold' ? 'background: #C62828; color: #FFF; border-color: #C62828;' : ''}">
                      ${p.status.toUpperCase()}
                    </span>
                  </td>
                  <td>${p.is_featured ? '⭐ Yes' : 'No'}</td>
                  <td>
                    <div style="display: flex; gap: 6px;">
                      <button type="button" class="btn btn-outline-charcoal" style="padding: 4px 8px; font-size: 0.62rem;" onclick="window.openPropertyModal(${p.id})">Edit</button>
                      <button type="button" class="btn btn-charcoal" style="padding: 4px 8px; font-size: 0.62rem; background: #C62828; border-color: #C62828;" onclick="window.deletePropertyConfirm(${p.id})">Delete</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- OFF-PLAN PROJECTS SECTION -->
      <div style="background: var(--color-white); border: 1px solid var(--color-border-light); padding: 1.8rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.2rem;">
          <div>
            <h3 style="font-size: 1.2rem; font-family: var(--font-sans);">Off-Plan Developments (${offplan.length})</h3>
            <span style="font-size: 0.72rem; color: var(--color-warmgray);">Direct developer off-plan towers and private island developments</span>
          </div>
          <button type="button" class="btn btn-gold" id="btn-add-offplan" style="font-size: 0.72rem; padding: 9px 18px;">
            + Add Off-Plan Project
          </button>
        </div>

        <div style="overflow-x: auto;">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Project Name</th>
                <th>Developer</th>
                <th>Community</th>
                <th>Starting Price</th>
                <th>Handover Date</th>
                <th>Payment Plan</th>
                <th>Units Available</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${offplan.map(proj => `
                <tr>
                  <td><strong>${proj.name}</strong></td>
                  <td>${proj.developer_name || 'Prime Developer'}</td>
                  <td>${proj.community}</td>
                  <td style="font-weight: 600; color: var(--color-gold);">${formatAED(proj.starting_price_aed)}</td>
                  <td>${proj.handover_date}</td>
                  <td style="font-size: 0.72rem;">${proj.payment_plan}</td>
                  <td>${proj.units_available || 20}</td>
                  <td>
                    <div style="display: flex; gap: 6px;">
                      <button type="button" class="btn btn-outline-charcoal" style="padding: 4px 8px; font-size: 0.62rem;" onclick="window.openProjectModal(${proj.id})">Edit</button>
                      <button type="button" class="btn btn-charcoal" style="padding: 4px 8px; font-size: 0.62rem; background: #C62828; border-color: #C62828;" onclick="window.deleteProjectConfirm(${proj.id})">Delete</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('btn-add-property')?.addEventListener('click', () => {
      window.openPropertyModal();
    });

    document.getElementById('btn-add-offplan')?.addEventListener('click', () => {
      window.openProjectModal();
    });

  } catch (err) {
    container.innerHTML = `<div style="padding: 2rem; color: #D32F2F;">Failed to load properties catalog: ${err.message}</div>`;
  }
}

/* --------------------------------------------------------------------------
   C. MODAL INTERFACES & WORKFLOWS
   -------------------------------------------------------------------------- */
function initAdminModals() {
  // 1. Close buttons
  document.getElementById('lead-detail-close-btn')?.addEventListener('click', () => {
    document.getElementById('lead-detail-modal')?.classList.remove('open');
  });

  document.getElementById('won-deal-close-btn')?.addEventListener('click', () => {
    document.getElementById('won-deal-modal')?.classList.remove('open');
  });

  document.getElementById('prop-modal-close-btn')?.addEventListener('click', () => {
    document.getElementById('property-modal')?.classList.remove('open');
  });

  document.getElementById('proj-modal-close-btn')?.addEventListener('click', () => {
    document.getElementById('project-modal')?.classList.remove('open');
  });

  document.getElementById('admin-viewing-close-btn')?.addEventListener('click', () => {
    document.getElementById('admin-viewing-modal')?.classList.remove('open');
  });

  // 2. Real-time 2% Commission Calculator on Won Deal input
  const wonPriceInput = document.getElementById('won-sale-price-input');
  if (wonPriceInput) {
    wonPriceInput.addEventListener('input', function() {
      const price = parseFloat(this.value) || 0;
      const commission = price * 0.02; // 2%
      const dld = price * 0.04; // 4%
      document.getElementById('won-calc-commission').textContent = formatAED(commission);
      document.getElementById('won-calc-dld').textContent = formatAED(dld);
    });
  }

  // 3. Won Deal Form Submit
  const wonForm = document.getElementById('won-deal-form');
  if (wonForm) {
    wonForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const leadId = document.getElementById('won-lead-id').value;
      const salePrice = parseFloat(document.getElementById('won-sale-price-input').value) || 0;
      const propId = document.getElementById('won-property-select').value;
      const buyerName = document.getElementById('won-buyer-name').value;
      const agentId = document.getElementById('won-agent-id').value;

      if (!salePrice || salePrice <= 0) {
        showToast('Please enter a valid sale price in AED.');
        return;
      }

      try {
        const res = await fetch(`/api/admin/leads/${leadId}/won`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sale_price_aed: salePrice,
            property_id: propId ? parseInt(propId, 10) : null,
            buyer_name: buyerName,
            agent_id: agentId ? parseInt(agentId, 10) : 1
          })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          showToast(data.error || 'Failed to record won deal.');
          return;
        }

        document.getElementById('won-deal-modal').classList.remove('open');
        showToast(`★ Deal Won! 2% Commission: ${formatAED(data.data.commission)}. Property marked as SOLD.`);

        // Reload active tab
        const user = getStaffSession();
        if (user) loadActiveAdminTab(user);
      } catch (err) {
        showToast('Connection error recording won deal.');
      }
    });
  }

  // 4. Property CRUD Submit
  const propForm = document.getElementById('property-crud-form');
  if (propForm) {
    propForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const propId = document.getElementById('prop-crud-id').value;
      const title = document.getElementById('prop-crud-title').value.trim();
      const community = document.getElementById('prop-crud-community').value;
      const subCommunity = document.getElementById('prop-crud-subcomm').value.trim();
      const type = document.getElementById('prop-crud-type').value;
      const status = document.getElementById('prop-crud-status').value;
      const bedrooms = parseInt(document.getElementById('prop-crud-beds').value, 10);
      const bathrooms = parseInt(document.getElementById('prop-crud-baths').value, 10);
      const sqft = parseInt(document.getElementById('prop-crud-sqft').value, 10);
      const price = parseFloat(document.getElementById('prop-crud-price').value);
      const agentId = parseInt(document.getElementById('prop-crud-agent').value, 10);
      const img = document.getElementById('prop-crud-img').value.trim();
      const desc = document.getElementById('prop-crud-desc').value.trim();
      const feats = document.getElementById('prop-crud-features').value.split(',').map(s => s.trim());
      const isFeatured = document.getElementById('prop-crud-featured').checked;

      const payload = {
        title,
        slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        community,
        sub_community: subCommunity,
        type,
        status,
        bedrooms,
        bathrooms,
        built_up_area_sqft: sqft,
        price_aed: price,
        assigned_agent_id: agentId,
        image_url: img,
        description: desc,
        features: feats,
        is_featured: isFeatured
      };

      const url = propId ? `/api/properties/${propId}` : '/api/properties';
      const method = propId ? 'PUT' : 'POST';

      try {
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        document.getElementById('property-modal').classList.remove('open');
        showToast(propId ? 'Property listing updated.' : 'New property added to portfolio.');

        // Refresh state
        await fetchInitialData();
        const user = getStaffSession();
        if (user) loadActiveAdminTab(user);
      } catch (err) {
        showToast('Error saving property: ' + err.message);
      }
    });
  }

  // 5. Off-Plan Project CRUD Submit
  const projForm = document.getElementById('project-crud-form');
  if (projForm) {
    projForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const projId = document.getElementById('proj-crud-id').value;
      const name = document.getElementById('proj-crud-name').value.trim();
      const devId = parseInt(document.getElementById('proj-crud-dev').value, 10);
      const community = document.getElementById('proj-crud-comm').value;
      const price = parseFloat(document.getElementById('proj-crud-price').value);
      const handover = document.getElementById('proj-crud-handover').value.trim();
      const payment = document.getElementById('proj-crud-payment').value.trim();
      const units = parseInt(document.getElementById('proj-crud-units').value, 10);
      const img = document.getElementById('proj-crud-img').value.trim();
      const desc = document.getElementById('proj-crud-desc').value.trim();

      const payload = {
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        developer_id: devId,
        community,
        starting_price_aed: price,
        handover_date: handover,
        payment_plan: payment,
        units_available: units,
        image_url: img,
        description: desc
      };

      const url = projId ? `/api/offplan/${projId}` : '/api/offplan';
      const method = projId ? 'PUT' : 'POST';

      try {
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        document.getElementById('project-modal').classList.remove('open');
        showToast(projId ? 'Off-plan development updated.' : 'New off-plan development added.');

        await fetchInitialData();
        const user = getStaffSession();
        if (user) loadActiveAdminTab(user);
      } catch (err) {
        showToast('Error saving project: ' + err.message);
      }
    });
  }

  // 6. Admin Book Viewing Form Submit
  const avForm = document.getElementById('admin-viewing-form');
  if (avForm) {
    avForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const leadId = document.getElementById('av-lead-id').value;
      const propId = document.getElementById('av-property-select').value;
      const date = document.getElementById('av-date').value;
      const time = document.getElementById('av-time').value;
      const mode = document.getElementById('av-mode').value;
      const notes = document.getElementById('av-notes').value;

      const user = getStaffSession();

      try {
        const res = await fetch('/api/viewings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            property_id: parseInt(propId, 10),
            lead_id: leadId ? parseInt(leadId, 10) : 1,
            viewing_date: date,
            viewing_time: time,
            viewing_mode: mode,
            notes,
            source_form: 'Admin Concierge Desk'
          })
        });

        if (res.ok) {
          document.getElementById('admin-viewing-modal').classList.remove('open');
          showToast('Private viewing scheduled on calendar.');
          if (user) loadActiveAdminTab(user);
        }
      } catch (err) {
        showToast('Error booking viewing');
      }
    });
  }
}

// Global modal opener for Lead Detail / Dossier
window.openLeadDetail = async function(leadId) {
  const modal = document.getElementById('lead-detail-modal');
  if (!modal) return;

  try {
    const res = await fetch(`/api/admin/leads/${leadId}`);
    if (!res.ok) throw new Error('Lead not found');
    const data = await res.json();
    const lead = data.data;

    // Header info
    document.getElementById('lead-modal-name').textContent = lead.full_name;
    document.getElementById('lead-modal-source').textContent = `Attributed Source: ${lead.source_form || 'Direct Website Inquiry'}`;

    // Badges
    const tempClass = lead.temperature === 'HOT' ? 'temp-badge-hot' : lead.temperature === 'WARM' ? 'temp-badge-warm' : 'temp-badge-cold';
    document.getElementById('lead-modal-badges').innerHTML = `
      <span class="temp-badge ${tempClass}" style="font-size: 0.65rem; padding: 4px 10px;">${lead.temperature}</span>
      <span class="score-pill" style="font-size: 0.72rem; padding: 4px 10px; background: #EAE6DF;">Score: ${lead.score || 50}/100</span>
      <span class="admin-badge-label" style="font-size: 0.6rem;">${lead.stage}</span>
    `;

    // Grid specs
    document.getElementById('lead-modal-phone').textContent = lead.phone || '--';
    document.getElementById('lead-modal-email').textContent = lead.email || 'None provided';
    document.getElementById('lead-modal-community').textContent = lead.preferred_community || 'Dubai Prime';
    document.getElementById('lead-modal-budget').textContent = lead.budget_bracket_aed || 'AED 15M+';
    document.getElementById('lead-modal-timeline').textContent = lead.timeline || 'Immediate';
    document.getElementById('lead-modal-cash').textContent = lead.cash_buyer ? 'YES (Verified Cash)' : 'Mortgage / Finance';
    document.getElementById('lead-modal-deal-val').textContent = formatAED(lead.deal_value_aed || 15000000);
    document.getElementById('lead-modal-activity').textContent = lead.last_activity_at ? new Date(lead.last_activity_at).toLocaleDateString() : 'Today';
    document.getElementById('lead-modal-asset').textContent = lead.property_title || (lead.property_id ? `Residence #${lead.property_id}` : 'General Inquiry');
    document.getElementById('lead-modal-msg').textContent = lead.message || 'No additional message noted.';

    // Action buttons
    const user = getStaffSession() || { name: 'Ayushi' };
    const cleanPhone = String(lead.phone || '').replace(/[^0-9]/g, '');

    document.getElementById('lead-modal-wa-btn').href = `https://wa.me/${cleanPhone}?text=Hello%20${encodeURIComponent(lead.full_name)},%20this%20is%20${encodeURIComponent(user.name)}%20from%20Ayushi%20Real%20Estate%20regarding%20your%20inquiry.`;
    document.getElementById('lead-modal-call-btn').href = `tel:${lead.phone}`;

    // Selects
    const stageSelect = document.getElementById('lead-modal-stage-select');
    stageSelect.value = lead.stage || 'New';
    stageSelect.onchange = async () => {
      await fetch(`/api/admin/leads/${lead.id}/stage`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: stageSelect.value })
      });
      showToast(`Lead stage updated to ${stageSelect.value}`);
      if (stageSelect.value === 'Won') {
        modal.classList.remove('open');
        window.openWonDeal(lead);
      }
    };

    const agentSelect = document.getElementById('lead-modal-agent-select');
    agentSelect.value = String(lead.assigned_agent_id || 1);
    agentSelect.onchange = async () => {
      await fetch(`/api/admin/leads/${lead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_agent_id: parseInt(agentSelect.value, 10) })
      });
      showToast('Lead assigned to advisor.');
    };

    // Won Deal action button
    document.getElementById('lead-modal-won-action-btn').onclick = () => {
      modal.classList.remove('open');
      window.openWonDeal(lead);
    };

    // Book viewing button
    document.getElementById('lead-modal-book-viewing-btn').onclick = () => {
      modal.classList.remove('open');
      window.openViewingModal(lead.id);
    };

    // Notes list
    const notesList = document.getElementById('lead-modal-notes-list');
    const renderNotes = (notes) => {
      if (!notes || notes.length === 0) {
        notesList.innerHTML = `<p style="font-size: 0.75rem; color: var(--color-warmgray); text-align: center; margin: 1rem 0;">No advisor notes recorded yet.</p>`;
        return;
      }
      notesList.innerHTML = notes.map(n => `
        <div class="note-item">
          <div class="note-meta">
            <strong>${n.author_name || 'Advisor'}</strong> • ${n.created_at ? new Date(n.created_at).toLocaleString() : 'Just now'}
          </div>
          <div class="note-body">${n.note_text}</div>
        </div>
      `).join('');
    };

    renderNotes(lead.notes || []);

    // Add note form
    const addNoteForm = document.getElementById('lead-modal-add-note-form');
    addNoteForm.onsubmit = async (e) => {
      e.preventDefault();
      const input = document.getElementById('lead-modal-note-input');
      const text = input.value.trim();
      if (!text) return;

      try {
        const nRes = await fetch(`/api/admin/leads/${lead.id}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staff_id: user.id || 1,
            author_name: user.name,
            note_text: text
          })
        });
        const nData = await nRes.json();
        if (nData.success) {
          input.value = '';
          const updatedNotes = await fetch(`/api/admin/leads/${lead.id}/notes`).then(r => r.json());
          renderNotes(updatedNotes.data || []);
          showToast('Note added to dossier.');
        }
      } catch (err) {
        showToast('Error saving note.');
      }
    };

    modal.classList.add('open');
  } catch (err) {
    showToast('Failed to open dossier: ' + err.message);
  }
};

// Global opener for Won Deal Modal (2% Commission Calculator)
window.openWonDeal = function(lead) {
  const modal = document.getElementById('won-deal-modal');
  if (!modal) return;

  document.getElementById('won-lead-id').value = lead.id;
  document.getElementById('won-agent-id').value = lead.assigned_agent_id || 1;
  document.getElementById('won-buyer-name').value = lead.full_name;

  // Populate properties in dropdown
  const propSelect = document.getElementById('won-property-select');
  propSelect.innerHTML = AppState.properties.map(p => `
    <option value="${p.id}" ${p.id === lead.property_id ? 'selected' : ''}>
      ${p.title} (${p.community}) - ${formatAED(p.price_aed)} [${p.status.toUpperCase()}]
    </option>
  `).join('');

  // Default price
  const defaultPrice = lead.deal_value_aed || 15000000;
  const priceInput = document.getElementById('won-sale-price-input');
  priceInput.value = defaultPrice;

  // Real-time calculation on modal open
  const comm = defaultPrice * 0.02;
  const dld = defaultPrice * 0.04;
  document.getElementById('won-calc-commission').textContent = formatAED(comm);
  document.getElementById('won-calc-dld').textContent = formatAED(dld);

  modal.classList.add('open');
};

// Global Property CRUD Modal Opener
window.openPropertyModal = function(propertyId = null) {
  const modal = document.getElementById('property-modal');
  if (!modal) return;

  const prop = propertyId ? AppState.properties.find(p => p.id === propertyId) : null;

  document.getElementById('prop-modal-heading').textContent = prop ? 'Edit Ready Property' : 'Add Ready Property';
  document.getElementById('prop-crud-id').value = prop ? prop.id : '';
  document.getElementById('prop-crud-title').value = prop ? prop.title : '';
  document.getElementById('prop-crud-community').value = prop ? prop.community : 'Palm Jumeirah';
  document.getElementById('prop-crud-subcomm').value = prop ? (prop.sub_community || '') : '';
  document.getElementById('prop-crud-type').value = prop ? prop.type : 'Villa';
  document.getElementById('prop-crud-status').value = prop ? prop.status : 'Available';
  document.getElementById('prop-crud-beds').value = prop ? prop.bedrooms : 4;
  document.getElementById('prop-crud-baths').value = prop ? prop.bathrooms : 5;
  document.getElementById('prop-crud-sqft').value = prop ? prop.built_up_area_sqft : 6200;
  document.getElementById('prop-crud-price').value = prop ? prop.price_aed : 18500000;
  document.getElementById('prop-crud-agent').value = prop ? (prop.assigned_agent_id || 1) : 1;
  document.getElementById('prop-crud-img').value = prop ? prop.image_url : 'assets/images/palm-waterfront-villa.jpg';
  document.getElementById('prop-crud-desc').value = prop ? prop.description : '';
  document.getElementById('prop-crud-features').value = prop && prop.features ? prop.features.join(', ') : 'Private Beach, Infinity Pool, Italian Marble, Smart Home';
  document.getElementById('prop-crud-featured').checked = prop ? prop.is_featured : true;

  modal.classList.add('open');
};

window.deletePropertyConfirm = async function(propertyId) {
  if (!confirm('Are you sure you want to remove this property listing from the Ayushi portfolio?')) return;
  try {
    const res = await fetch(`/api/properties/${propertyId}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Property deleted successfully.');
      await fetchInitialData();
      const user = getStaffSession();
      if (user) loadActiveAdminTab(user);
    }
  } catch (err) {
    showToast('Failed to delete property.');
  }
};

// Global Off-Plan Project Modal Opener
window.openProjectModal = function(projectId = null) {
  const modal = document.getElementById('project-modal');
  if (!modal) return;

  const proj = projectId ? AppState.offplan.find(p => p.id === projectId) : null;

  document.getElementById('proj-modal-heading').textContent = proj ? 'Edit Off-Plan Project' : 'Add Off-Plan Project';
  document.getElementById('proj-crud-id').value = proj ? proj.id : '';
  document.getElementById('proj-crud-name').value = proj ? proj.name : '';
  document.getElementById('proj-crud-dev').value = proj ? proj.developer_id : 1;
  document.getElementById('proj-crud-comm').value = proj ? proj.community : 'Palm Jumeirah';
  document.getElementById('proj-crud-price').value = proj ? proj.starting_price_aed : 3850000;
  document.getElementById('proj-crud-handover').value = proj ? proj.handover_date : 'Q4 2027';
  document.getElementById('proj-crud-payment').value = proj ? proj.payment_plan : '60/40 on Handover';
  document.getElementById('proj-crud-units').value = proj ? (proj.units_available || 24) : 24;
  document.getElementById('proj-crud-img').value = proj ? proj.image_url : 'assets/images/lumina-tower.jpg';
  document.getElementById('proj-crud-desc').value = proj ? proj.description : '';

  modal.classList.add('open');
};

window.deleteProjectConfirm = async function(projectId) {
  if (!confirm('Are you sure you want to remove this off-plan development?')) return;
  try {
    const res = await fetch(`/api/offplan/${projectId}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Off-plan project removed.');
      await fetchInitialData();
      const user = getStaffSession();
      if (user) loadActiveAdminTab(user);
    }
  } catch (err) {
    showToast('Failed to delete off-plan project.');
  }
};

// Global Viewing Modal Opener
window.openViewingModal = function(leadId = null) {
  const modal = document.getElementById('admin-viewing-modal');
  if (!modal) return;

  document.getElementById('av-lead-id').value = leadId || '';

  const propSelect = document.getElementById('av-property-select');
  propSelect.innerHTML = AppState.properties.map(p => `
    <option value="${p.id}">${p.title} (${p.community}) - ${formatAED(p.price_aed)}</option>
  `).join('');

  // Set default date to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('av-date').value = tomorrow.toISOString().substring(0, 10);

  modal.classList.add('open');
};
