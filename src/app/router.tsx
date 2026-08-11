import { createBrowserRouter, Navigate } from "react-router-dom";
import { env } from "../lib/env";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { RegisterPage } from "../features/auth/pages/RegisterPage";
import { ForgotPasswordPage } from "../features/auth/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "../features/auth/pages/ResetPasswordPage";
import { ProtectedRoute } from "../features/auth/components/ProtectedRoute";
import { AppLayout } from "../components/layout/AppLayout";
import { HomePage } from "../features/home/pages/HomePage";
import { QuotesPage } from "../features/quotes/pages/QuotesPage";
import { QuoteDetailsPage } from "../features/quotes/pages/QuoteDetailsPage";
import { CustomersPage } from "../features/customers/pages/CustomersPage";
import { CustomerDetailsPage } from "../features/customers/pages/CustomerDetailsPage";
import { SettingsPage } from "../features/settings/pages/SettingsPage";
import { ServiceCatalogPage } from "../features/catalog/pages/ServiceCatalogPage";
import { ProjectsPage } from "../features/projects/pages/ProjectsPage";
import { ProjectDetailsPage } from "../features/projects/pages/ProjectDetailsPage";
import { AdminRoute } from "../features/admin/components/AdminRoute";
import { AdminPage } from "../features/admin/pages/AdminPage";
import { PublicQuotePage } from "../features/quotes/pages/PublicQuotePage";
import { SubscriptionRequiredRoute } from "../features/subscriptions/SubscriptionRequiredRoute";
import { SubscriptionPage } from "../features/subscriptions/pages/SubscriptionPage";
import { InvoicesPage } from "../features/invoices/pages/InvoicesPage";
import { InvoiceDetailsPage } from "../features/invoices/pages/InvoiceDetailsPage";
import { SupplyCatalogPage } from "../features/supplies/pages/SupplyCatalogPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    // Inscription libre coupée en phase de test : les anciens liens
    // retombent sur la connexion au lieu de renvoyer une 404.
    path: "/register",
    element: env.signupEnabled ? <RegisterPage /> : <Navigate to="/login" replace />,
  },
  {
    path: "/mot-de-passe-oublie",
    element: <ForgotPasswordPage />,
  },
  {
    path: "/reinitialiser-mot-de-passe",
    element: <ResetPasswordPage />,
  },
  {
    path: "/devis-client",
    element: <PublicQuotePage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: <AppLayout />,
        children: [
          {
            index: true,
            element: <HomePage />,
          },
          {
            element: <SubscriptionRequiredRoute />,
            children: [
              {
                path: "devis",
                element: <QuotesPage />,
              },
              {
                path: "devis/:quoteId",
                element: <QuoteDetailsPage />,
              },
              {
                path: "factures",
                element: <InvoicesPage />,
              },
              {
                path: "factures/:invoiceId",
                element: <InvoiceDetailsPage />,
              },
            ],
          },
          {
            path: "clients",
            element: <CustomersPage />,
          },
          {
            path: "clients/archives",
            element: <Navigate to="/clients?status=archived" replace />,
          },
          {
            path: "clients/:customerId",
            element: <CustomerDetailsPage />,
          },
          {
            path: "projets",
            element: <ProjectsPage />,
          },
          {
            path: "projets/:projectId",
            element: <ProjectDetailsPage />,
          },
          {
            path: "catalogue",
            element: <ServiceCatalogPage />,
          },
          {
            path: "fournisseurs",
            element: <SupplyCatalogPage />,
          },
          {
            path: "parametres",
            element: <SettingsPage />,
          },
          {
            path: "abonnement",
            element: <SubscriptionPage />,
          },
          {
            path: "admin",
            element: <AdminRoute />,
            children: [
              {
                index: true,
                element: <AdminPage />,
              },
            ],
          },
        ],
      },
    ],
  },
]);
