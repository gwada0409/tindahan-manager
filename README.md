# 🏪 Tindahan Manager — Modern POS & Inventory PWA

[![React](https://img.shields.io/badge/React-19.2-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-purple?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind--CSS-4.3-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Dexie.js](https://img.shields.io/badge/Dexie.js-4.4-brightgreen)](https://dexie.org/)
[![PWA](https://img.shields.io/badge/PWA-Offline--Capable-orange)](https://web.dev/progressive-web-apps/)

**Tindahan Manager** is a modern, offline-first Point-of-Sale (POS) and inventory management Progressive Web App (PWA) designed specifically for retail stores and sari-sari business operations.

---

## ✨ Features

- ⚡ **Offline-First PWA**: Fully functional without an active internet connection using Dexie.js (IndexedDB) and Service Workers.
- 📦 **Smart FEFO/FIFO Inventory**: Track physical batches by restock date and expiration date. Automatically calculates stock status (`Out of Stock`, `Critical`, `Low Stock`, `In Stock`).
- 🛒 **Point of Sale (POS)**: Rapid checkout with real-time stock validation, cart item caps, discount calculations, and camera barcode scanning (`@ericblade/quagga2`).
- 🏷️ **Barcode Scanner Support**: Integrates both physical USB/Bluetooth hardware scanners and live device camera barcode scanning.
- 📝 **Customer Credit ("Utang") Ledger**: Track customer debt balances, record partial payments, and enforce customer credit limits.
- 📱 **GCash & Vault Ledger**: Track digital GCash float cash-ins/cash-outs and cash vault movements.
- 👥 **Role-Based Access Control (RBAC)**: Centralized authorization separating **Admin** (full access & settings) from **Employee** (restricted sales & inventory operation).
- 🎨 **Custom Branding & Theme Customization**: Custom application name, primary/accent color pickers with live component preview and automatic WCAG AA contrast calculation.

---

## 🔐 Access Control & Role Matrix

| Section | Admin | Employee |
|---|:---:|:---:|
| **Dashboard** | ✅ | ✅ |
| **Sales (POS)** | ✅ | ✅ |
| **Inventory (View/Restock)** | ✅ | ✅ |
| **Services & Repairs** | ✅ | ✅ |
| **Utang (Customer Credit)** | ✅ | ✅ |
| **GCash Transactions** | ✅ | ✅ |
| **Bills & Expenses** | ✅ | ✅ |
| **Employees Directory** | ✅ | ❌ |
| **User Account Access (RBAC)** | ✅ | ❌ |
| **Vault & Financial Ledger** | ✅ | ❌ |
| **Reports & Analytics** | ✅ | ❌ |
| **Settings & Branding** | ✅ | ❌ |
| **Database Backup & Reset** | ✅ | ❌ |

---

## 🏗️ Architecture & Security

### 1. Authentication Architecture
The application uses a clean, decoupled `AuthService` with dual support:
- **DevAuthAdapter**: Local mock authentication for rapid offline development with default accounts:
  - **Admin**: `admin@tindahan.ph` / `admin123`
  - **Employee**: `employee@tindahan.ph` / `employee123`
- **SupabaseAuthAdapter**: Ready for cloud authentication using Supabase Auth SDK.

> [!IMPORTANT]
> **Last Admin Protection**: The application prevents deactivating, demoting, or removing the last active administrator account to prevent administrative lockout.

### 2. Database Schema (IndexedDB / Dexie.js)
The app uses Dexie database versioning with automatic V1 → V2 → V3 schema migration:
- `products`: Product metadata, SKUs, barcodes, reorder levels.
- `inventoryBatches`: Authoritative stock quantities, unit costs, expiration dates (`[productId+expirationDate]`).
- `stockMovements`: Audit trail of restocks, sales, returns, and adjustments.
- `userProfiles`: Link between authenticated identities and application roles (`id, &authUserId, employeeId, role, active`).
- `storeSettings`: Custom branding name and primary/accent theme hex codes.

---

## ⚙️ Environment Configuration

Copy `.env.example` to create your local `.env` file:

```bash
cp .env.example .env
```

### Environment Variables (`.env`)
```env
# Supabase Production Auth Configuration
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Supabase Setup Instructions
1. Create a project at [supabase.com](https://supabase.com).
2. Go to **Project Settings > API** and copy your `URL` and `anon key`.
3. Paste them into your `.env` file.
4. Under **Authentication > URL Configuration**, add your application's domain (e.g. `http://localhost:5173` or your production domain) to the **Redirect URLs**.

---

## 🚀 Getting Started

### Prerequisites
- Node.js `20.14.0` or higher
- npm `10.7.0` or higher

### Installation & Run

1. **Clone repository**:
   ```bash
   git clone https://github.com/gwada0409/tindahan-manager.git
   cd tindahan-manager
   ```

2. **Install dependencies**:
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Start local dev server**:
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:5173`.

4. **Run Unit & Integration Tests**:
   ```bash
   npm run test
   ```

5. **Build for Production**:
   ```bash
   npm run build
   ```

---

## 🛡️ Deployment Security Checklist

- [ ] Ensure `.env` is included in `.gitignore` and credentials are never committed.
- [ ] Configure Supabase Site URL and Redirect URLs for your production domain.
- [ ] Verify HTTPS is enabled (required for PWA Service Workers & Web Camera API).
- [ ] Test the PWA installation prompt and offline mode on target mobile and desktop devices.
- [ ] Confirm default demo password accounts are disabled or replaced before production use.

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for details.
