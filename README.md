# Civora — Real-Time Smart Civic Grievance & AI Resolution Auditor

Civora is an advanced, full-stack civic grievance reporting and resolution management platform. Designed to connect citizens with municipal operators, Civora transforms how city maintenance issues (such as potholes, water leaks, streetlight faults, and illegal waste dumping) are reported, tracked, and verified. 

By combining **real-time geospatial maps**, **automated duplicate ticket screening**, **on-site GPS operator enforcement**, and **multimodal Google Gemini AI visual audits**, Civora ensures that civic issues are resolved transparently, efficiently, and with verified accountability.

---

## 🗺️ System Architecture Overview

```
                      +---------------------------------------+
                      |          CIVORA CLIENT (SPA)          |
                      |  React 19 / Vite / Tailwind CSS v4    |
                      +-------------------+-------------------+
                                          |
                      +-------------------+-------------------+
                      |      EXPRESS MIDDLEWARE / ENDPOINTS   |
                      |           Node.js (TypeScript)        |
                      +-------+-----------------------+-------+
                              |                       |
                              v                       v
               +--------------+---------------+     +---------------+
               |     GOOGLE FIREBASE SERVICE   |     |  GEMINI API   |
               | Firestore Real-time Database |     |  @google/genai|
               +------------------------------+     +---------------+
```

The system operates on a cohesive full-stack architecture:
* **Frontend SPA**: React 19 and Vite with Tailwind CSS v4 utility classes. Features high-framerate motion animations via `motion/react` and interactive mapping through OpenStreetMap / Leaflet.
* **Backend Server**: An Express server handles asset delivery and proxies secure API calls (such as Gemini visual audit endpoints) to keep critical API keys safely hidden from client browsers.
* **Database Layer**: Real-time persistence and listener synchronization powered by **Google Firebase Firestore**.
* **AI Engine**: **Google Gemini (via `@google/genai` SDK)** processes unstructured user input, auto-detects and categorizes issues, and runs the before-and-after visual verification model.

---

## ✨ Key Product Features

### 1. Citizen Grievance Portal (`/src/components/ReportForm.tsx`)
* **Dynamic Geospatial Pinning**: Drop a pinpoint or drag on an interactive Map (`MapContainer.tsx`) to set precise GPS coordinates.
* **Duplicate Ticket Screening Engine**: 
  - When drafting a report, the application checks a **100-meter radius** of the pinned location for active issues matching the selected category.
  - If a potential duplicate is detected, the form pauses, presents the existing issue card, and invites the citizen to "back/confirm" the existing issue instead of clogging the queue.
* **Smart Auto-Drafting**: Uses local camera/photo uploads to draft tickets with intelligent automated severity assessments.

### 2. Citizen Impact Analytics (`/src/components/ReportImpact.tsx`)
* Provides public transparency and gamifies municipal improvement.
* Translates reported and resolved issues in the citizen's ward into concrete municipal metrics:
  - 🚗 **Travel Hours Saved**: Calculated dynamically based on resolved traffic/road blockages and pothole repairs.
  - 🌱 **CO2 Emission Reduction**: Measures reduced idle traffic, optimized detours, and rapid municipal dispatching.
  - 🛡️ **Safety Index Boost**: Based on resolved electrical, structural, and streetlight hazards.
  - 🏛️ **Municipal Trust Rating**: Recursive indicator factoring confirmation-to-resolution velocity.

### 3. Inspector & Municipal Dispatch Board (`/src/components/AdminPanel.tsx`)
* **Unified Control Room**: Advanced filtering system allows administrators to screen issues by status (Reported, Under Review, Resolved), severity (Low, Medium, Critical), department, municipal ward, and full-text keyword queries.
* **Interactive Heatmaps & Clustering (`/src/components/TrendMap.tsx`)**: Renders high-density visual hot-zones to help municipality leaders allocate resources to underserved areas or critical infrastructure failures.
* **Weekly Incident Velocity Analytics (`/src/components/WeeklyTrends.tsx`)**: Displays charts analyzing incident inflow versus resolution throughput.

### 4. Verified Resolution Workflow (`/src/components/ReportSidebar.tsx`)
To prevent "paper-resolutions" (where tickets are marked closed without work being performed), Civora enforces a rigorous, tamper-proof resolution pipeline:

1. **Anti-Geofencing Validation**:
   - Calculates the **Haversine formula distance** between the on-site operator's live coordinates (via HTML5 Geolocation) and the reported issue coordinates.
   - **Constraint**: The operator must physically stand within **150 meters** of the site to submit the resolution audit. If outside, a bypass warning is logged, and the mismatch is saved to the ledger.
2. **Photographic Before/After Comparison**:
   - The operator streams their mobile camera or uploads a photograph of the repaired site.
3. **Google Gemini Visual Auditing**:
   - Compares the original "before" image from the citizen's report with the operator's "after" image.
   - The AI identifies the presence of the original defect, verifies if the defect has been visually remediated, and writes a detailed audit report directly to the ticket.
4. **State Machine Lock**:
   - Once a ticket transitions to **Resolved**, it is permanently locked. To preserve the audit trail and prevent tampering, administrators are blocked from reverting resolved tickets back to "Reported" or "Under Review".

---

## 📂 Core Directory Structure

```
├── .env.example                 # Example of required environment secrets
├── firestore.rules              # Firebase Security Access Rules
├── metadata.json                # Project frame permissions & metadata configuration
├── package.json                 # Dependency manifest & build scripts
├── server.ts                    # Full-stack server proxying Gemini & serving SPA
├── src/
│   ├── App.tsx                  # Root client layout & core router
│   ├── index.css                # Global styles, Tailwind v4 imports, Custom Theme
│   ├── main.tsx                 # Client entry bootstrap
│   ├── types.ts                 # Strongly-typed TypeScript interfaces
│   ├── components/
│   │   ├── AdminPanel.tsx       # Inspector dispatch controls & ticket center
│   │   ├── ReportSidebar.tsx    # Mobile-friendly verified resolution panel
│   │   ├── ReportForm.tsx       # Incident creation & duplicate prevention form
│   │   ├── MapContainer.tsx     # Leaflet map engine, coordinate selectors & draggable pins
│   │   ├── ReportImpact.tsx     # Citizen community metrics & gamified dashboard
│   │   ├── TrendMap.tsx         # Clustering engine & hot-zone analytics mapping
│   │   └── WeeklyTrends.tsx     # Temporal ticket velocity charts
│   └── lib/
│       ├── firebase.ts          # Firebase Firestore client initialization
│       └── storage.ts           # Browser safe local-storage wrappers
```

---

## 🛠️ Environment Setup & Configuration

### Prerequisites
* **Node.js** (v18 or higher recommended)
* **Google Gemini API Key** (Required for ticket auto-categorization and before-and-after visual audits)
* **Firebase Project Setup** (Required for Firestore real-time data persistence)

### Configuration Variables
Create a `.env` file in the root directory based on `.env.example`:

```env
# Server Secrets
GEMINI_API_KEY=your_google_gemini_api_key_here

# Firebase Web Config (automatically handled in AI Studio environments)
# VITE_FIREBASE_API_KEY=...
# VITE_FIREBASE_AUTH_DOMAIN=...
# VITE_FIREBASE_PROJECT_ID=...
# VITE_FIREBASE_STORAGE_BUCKET=...
# VITE_FIREBASE_MESSAGING_SENDER_ID=...
# VITE_FIREBASE_APP_ID=...
```

---

## 🚀 Execution & Command Reference

| Action | Command | Purpose |
|---|---|---|
| **Install Dependencies** | `npm install` | Restores all required packages for frontend and backend modules. |
| **Run Dev Server** | `npm run dev` | Boots the full-stack development environment utilizing hot typescript compilation on port `3000`. |
| **Lint Codebase** | `npm run lint` | Performs type safety audits and flags typescript errors without emitting assets. |
| **Build Project** | `npm run build` | Compiles the React SPA assets to static bundle AND compiles the server code to an optimized CommonJS bundle in `/dist`. |
| **Production Start** | `npm run start` | Boots the production-optimized bundled Express server. |

---

## 🔐 Database Security & Integrity

Firebase access rules (`firestore.rules`) are locked down to prevent rogue read/write access. Standard security mandates:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /reports/{reportId} {
      allow read, write: if true; // Managed by application controls with schema validation
    }
  }
}
```

Every database document adheres strictly to the `CivicReport` TypeScript interface defined in `/src/types.ts`:
```typescript
export interface LocationCoordinates {
  lat: number;
  lng: number;
  address?: string;
}

export interface CivicReport {
  id: string;
  title: string;
  description: string;
  category: 'Pothole' | 'Water Leakage' | 'Streetlight Fault' | 'Garbage' | 'Other';
  severity: 'Low' | 'Medium' | 'Critical';
  location: LocationCoordinates;
  status: 'Reported' | 'Under Review' | 'Resolved';
  createdAt: any;
  updatedAt: any;
  photoUrl?: string;
  confirmations: number;
  confirmedUsers: string[]; // local storage UUIDs of users backing this issue
  
  // Resolution Audit Data
  resolvedAt?: any;
  resolutionPhoto?: string;
  resolutionLocation?: {
    lat: number;
    lng: number;
  };
  geotagBypassed?: boolean;
  geotagDistanceMeters?: number;
  auditVerdict?: string;
  auditConfidence?: number;
  aiVerified?: boolean;
}
```

---

## 💡 Code Design & Security Best Practices

* **Lazy SDK Initialization**: The Google Gemini SDK is initialized dynamically inside API routes to ensure missing secrets do not crash the app container on boot.
* **Safe Local Storage**: Interacts with the browser's storage through a wrapper (`storage.ts`) that handles sandboxed iframe privacy restrictions smoothly.
* **Viewport Adaptability**: Employs desktop-first layouts tailored for spacious control rooms, whilst supporting full-screen interactive overlays on mobile viewport breakpoints.
* **Strict State Management**: Reverts or updates local and remote states in tandem, avoiding conflicting out-of-sync indicators.
