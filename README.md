# 🏛️ Ayushi Real Estate — Luxury Dubai Real Estate Portal & CRM

A bespoke, ultra-luxury real estate portal and CRM for Dubai ready residences and flagship off-plan developments. Designed to the highest aesthetic standards inspired by premier Dubai developers (Cormorant Garamond serif typography, minimal charcoal `#1A1A1A`, off-white `#F7F5F2`, and refined touches of `#B8975A` gold).

---

## ⚡ Quick Start: How to Run the Website

### Prerequisites
- Node.js (version 18 or higher recommended)
- Modern web browser (Chrome, Safari, Firefox, Edge)

### Simple 3 Steps to Run:
```bash
# 1. Open Terminal in the project folder:
cd "/Users/ayu/Desktop/Ayushi real state"

# 2. Install dependencies:
npm install

# 3. Start both the API Server and Vite frontend:
npm run dev
```

Visit the website in your browser:
- **Public Portal:** [http://localhost:5173/](http://localhost:5173/)
- **Private Admin CRM:** [http://localhost:5173/#/admin/login](http://localhost:5173/#/admin/login)

*(Note: The server runs seamlessly out of the box with a built-in luxury sample dataset in memory even before you connect your Neon database).*

---

## 🔐 Staff & Admin Logins

The admin portal provides real-time lead tracking, Kanban pipeline drag-and-drop, automated lead scoring (0–100 HOT/WARM/COLD), viewings scheduler, agent commission tracking (2%), and property CRUD.

| Name | Role | Email | Password | Access Level |
| :--- | :--- | :--- | :--- | :--- |
| **Ayushi Kapoor** | Managing Director | `ayushi@ayushirealestate.ae` | `admin123` | **Full Admin** (All leads, agents, pipeline, CRUD) |
| **Tariq Al-Hashimi** | Senior VP Advisory | `tariq@ayushirealestate.ae` | `tariq123` | **Agent** (Strictly sees his own assigned leads) |
| **Elena Rostova** | Senior Director | `elena@ayushirealestate.ae` | `elena123` | **Agent** (Strictly sees her own assigned leads) |

---

## 📌 Where to Paste Your Neon Database Link

1. Open the file named `.env` in the root of the project:
   ```
   /Users/ayu/Desktop/Ayushi real state/.env
   ```
2. Replace the connection string with your Neon PostgreSQL URL:
   ```env
   DATABASE_URL=postgresql://[username]:[password]@[ep-your-subdomain].neon.tech/neondb?sslmode=require
   PORT=3005
   ```
3. Once pasted, seed the database with all 16 luxury properties, 6 off-plan projects, 5 developers, and 40 leads:
   ```bash
   npm run db:setup
   ```

---

## 🛡️ Privacy & Security: How Keys & Passwords Stay Private

Your sensitive information is guarded with multi-layer security:
1. **Strict Git Ignore:** `.env` and all credential files are explicitly ignored in `.gitignore`. They will **never** be uploaded or visible on GitHub.
2. **Safe Template Provided:** Only `.env.example` (containing safe placeholder values) is committed.
3. **Password Redaction:** User passwords are encrypted / never returned in API responses or visible in client storage.
4. **Rate Limiting & Anti-Spam:** Both client-side and server-side rate limiters (4-second minimum interval, 4 requests/min) prevent form flooding.

---

## 🔍 Google SEO & Admin Privacy Protection

- **Google Discovery for Public Pages:**
  - Full `sitemap.xml` listing all property listings, projects, and calculators.
  - Rich Open Graph & Twitter Card social preview metadata.
  - Google Schema.org `RealEstateAgent` JSON-LD structured data.
  - Descriptive titles and meta tags on every route.
- **Admin Hidden from Google:**
  - `robots.txt` explicitly disallows search engines from crawling `/admin`, `/#/admin`, and `/api`.
  - Dynamic `<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">` is automatically injected into `<head>` whenever an admin or staff route is active.
  - Backend server sends `X-Robots-Tag: noindex, nofollow` on all `/api/*` and `/admin/*` requests.

---

## 💻 Exact Steps to Save Everything to GitHub

Follow these exact steps to push your repository to your GitHub account:

### Step 1: Open Terminal in Project Folder
```bash
cd "/Users/ayu/Desktop/Ayushi real state"
```

### Step 2: Stage and Commit All Files
The repository is already initialized with `.gitignore` protecting your `.env` file:
```bash
git add .
git commit -m "feat: complete luxury real estate portal with crm, lead scoring, and seo"
```

### Step 3: Create a Repository on GitHub
1. Open your browser and go to [https://github.com/new](https://github.com/new).
2. Enter Repository name: `ayushi-real-estate` (or your preferred name).
3. Choose **Private** or **Public**.
4. **Do NOT** check "Initialize this repository with a README or .gitignore" (we already have both).
5. Click **Create repository**.

### Step 4: Link Your Local Code to GitHub and Push
Copy the commands shown on your GitHub screen, or run:
```bash
# Set your primary branch to main:
git branch -M main

# Add your remote GitHub URL (replace USERNAME with your GitHub username):
git remote add origin https://github.com/USERNAME/ayushi-real-estate.git

# Push your project to GitHub:
git push -u origin main
```

*(If you use GitHub Desktop or the GitHub CLI `gh repo create`, you can also push with one click).*

---

## ✨ Features Overview

1. **Luxury Dubai Visuals & Preloader:**
   - Shimmering gold hairline preloader with Dubai title and smooth fade-out.
   - Luxury 404 & 500 error views in Cormorant Garamond typography.
   - Minimalist gold-accented Dubai developer aesthetics.
2. **Public Pages:**
   - **Home (`#/`)**: Hero with Dubai skyline, search filter bar, featured residences, off-plan developments, "Why Invest in Dubai", and community spotlights.
   - **Properties (`#/properties`)**: Live search & filter across Palm Jumeirah, Downtown, Dubai Hills, Dubai Marina, Business Bay, and JVC.
   - **Property Detail (`#/property/:slug`)**: Full gallery, specifications, amenities, "Book a Viewing", and "Enquire" forms.
   - **Off-Plan Projects (`#/offplan`)**: Detailed payment milestones, handover dates, developer portfolios, and "Download Brochure" forms.
   - **Mortgage Calculator (`#/calculator`)**: Live UAE Central Bank mortgage calculator with upfront DLD transfer fee, trustee fee, valuation fee, and Golden Visa eligibility badge.
   - **Sell / List With Us (`#/sell`)**: Consignment valuation intake form.
   - **About (`#/about`)**: Private office profile and senior licensed advisory directors.
   - **Contact (`#/contact`)**: DIFC Gate Village private salon details.
3. **Lead Management & Scoring (0–100):**
   - Automatically attributes leads to source forms.
   - Calculates score based on cash buyer status, budget bracket, timeline, and property interest.
   - Categorizes into **HOT**, **WARM**, or **COLD**.
   - Displays exact required confirmation: *"Thank you. A Jay Real Estate advisor will contact you within 24 hours."*
4. **CRM Admin Suite:**
   - Executive Dashboard with 4 KPI cards and pipeline & temperature charts.
   - Drag-and-drop Kanban Board across 6 stages (`New`, `Contacted`, `Viewing`, `Offer`, `Won`, `Lost`).
   - "Won" deal modal with automated 2% commission calculation and property "Sold" status update.
   - Leads list with real-time search, filters, and "Download to Excel" CSV export.
   - Lead detail drawer with WhatsApp & Direct Call actions, agent reassignment, and timeline notes.
   - 60-second auto-refreshing notification bell.
   - Stale leads tracker (inactivity for 3+ days).
   - Viewings calendar & Agent leaderboard against monthly targets.
   - Full CRUD for properties and projects.
5. **Mobile Responsiveness:**
   - Full-screen luxury mobile navigation drawer.
   - Touch-friendly swipeable Kanban board with horizontal snapping.
   - Horizontally scrollable and responsive tables.
   - Responsive modals tailored for all screen sizes (desktop, tablet, mobile).
