import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt';
import { AppLayout } from './components/layout/AppLayout';
import { Login } from './pages/Login';
import { RequireAuth } from './features/auth/components/RequireAuth';
import { RequirePermission } from './features/auth/components/RequirePermission';
import { AuthProvider } from './features/auth/AuthProvider';

import { Dashboard } from './pages/Dashboard';
import { Inventory } from './pages/Inventory';
import { Sales } from './pages/Sales';
import { Utang } from './pages/Utang';
import { GCash } from './pages/GCash';
import { Bills } from './pages/Bills';
import { Employees } from './pages/Employees';
import { Vault } from './pages/Vault';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Conflicts } from './pages/Conflicts';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { StoreSelection } from './pages/StoreSelection';
import { InitialMigration } from './pages/InitialMigration';
import { RequireInitialMigration } from './features/migration/RequireInitialMigration';

function App() {
  return (
    <ToastProvider>
      <PwaUpdatePrompt />
      <HashRouter>
        <AuthProvider>
          <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/select-store" element={<StoreSelection />} />
          <Route path="/migration" element={<RequireAuth><InitialMigration /></RequireAuth>} />

          {/* Protected Application Routes */}
          <Route
            element={
              <RequireAuth>
                <RequireInitialMigration><AppLayout /></RequireInitialMigration>
              </RequireAuth>
            }
          >
            <Route
              path="/"
              element={
                <RequirePermission permission="dashboard:view">
                  <Dashboard />
                </RequirePermission>
              }
            />
            <Route
              path="/sales"
              element={
                <RequirePermission permission="sales:use">
                  <Sales />
                </RequirePermission>
              }
            />
            <Route
              path="/inventory"
              element={
                <RequirePermission permission="inventory:view">
                  <Inventory />
                </RequirePermission>
              }
            />
            <Route
              path="/services"
              element={
                <RequirePermission permission="services:manage">
                  <div className="p-4 bg-white rounded-xl border">Services & Repairs coming soon</div>
                </RequirePermission>
              }
            />
            <Route
              path="/utang"
              element={
                <RequirePermission permission="utang:manage">
                  <Utang />
                </RequirePermission>
              }
            />
            <Route
              path="/gcash"
              element={
                <RequirePermission permission="gcash:manage">
                  <GCash />
                </RequirePermission>
              }
            />
            <Route
              path="/bills"
              element={
                <RequirePermission permission="bills:manage">
                  <Bills />
                </RequirePermission>
              }
            />
            <Route
              path="/employees"
              element={
                <RequirePermission permission="employees:manage">
                  <Employees />
                </RequirePermission>
              }
            />
            <Route
              path="/vault"
              element={
                <RequirePermission permission="vault:manage">
                  <Vault />
                </RequirePermission>
              }
            />
            <Route
              path="/reports"
              element={
                <RequirePermission permission="reports:view">
                  <Reports />
                </RequirePermission>
              }
            />
            <Route
              path="/conflicts"
              element={
                <RequirePermission permission="settings:manage">
                  <Conflicts />
                </RequirePermission>
              }
            />
            <Route
              path="/settings"
              element={
                <RequirePermission permission="settings:manage">
                  <Settings />
                </RequirePermission>
              }
            />
          </Route>
          </Routes>
        </AuthProvider>
      </HashRouter>
    </ToastProvider>
  );
}

export default App;
