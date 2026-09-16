import React from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import { LoginPage } from "../features/auth/LoginPage";
import { PasswordResetPage } from "../features/auth/PasswordResetPage";
import { PublicMenuPage } from "../features/catalog/public-menu/PublicMenuPage";
import { ProtectedRoute } from "../guards/ProtectedRoute";
import { AppShell } from "../components/AppShell";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { UsersPage } from "../features/users/UsersPage";
import { TablesOrdersPage } from "../features/tables-orders/TablesOrdersPage";
import { KitchenPage } from "../features/kitchen/KitchenPage";
import { CashPage } from "../features/cash/CashPage";
import { InventoryPage } from "../features/inventory/InventoryPage";
import { ExpensesPage } from "../features/expenses/ExpensesPage";
import { PredictiveAlertsPage } from "../features/predictions/PredictiveAlertsPage";
import { ReportsPage } from "../features/reports/ReportsPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { CatalogProductsPage } from "../features/catalog/products/CatalogProductsPage";

export default function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/password-reset" element={<PasswordResetPage />} />
      <Route path="/menu" element={<PublicMenuPage />} />

      {/* Protected Routes (AppShell) */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/products" element={<CatalogProductsPage />} />
          <Route path="/catalog" element={<CatalogProductsPage />} />
          <Route path="/tables" element={<TablesOrdersPage />} />
          <Route path="/tables-orders" element={<TablesOrdersPage />} />
          <Route path="/kitchen" element={<KitchenPage />} />
          <Route path="/cash" element={<CashPage />} />
          <Route path="/payments" element={<CashPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/costs" element={<ExpensesPage />} />
          <Route path="/predictive-alerts" element={<PredictiveAlertsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
