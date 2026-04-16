import { createBrowserRouter } from "react-router-dom";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { RegisterPage } from "../features/auth/pages/RegisterPage";
import { ProtectedRoute } from "../features/auth/components/ProtectedRoute";
import { AppLayout } from "../components/layout/AppLayout";
import { QuotesPage } from "../features/quotes/pages/QuotesPage";
import { QuoteDetailsPage } from "../features/quotes/pages/QuoteDetailsPage";
import { CustomersPage } from "../features/customers/pages/CustomersPage";
import { CustomerDetailsPage } from "../features/customers/pages/CustomerDetailsPage";
import { ArchivedCustomersPage } from "../features/customers/pages/ArchivedCustomersPage";
import { SettingsPage } from "../features/settings/pages/SettingsPage";
import { ServiceCatalogPage } from "../features/catalog/pages/ServiceCatalogPage";
import { InvoicesPage } from "../features/invoices/pages/InvoicesPage";
import { InvoiceDetailsPage } from "../features/invoices/pages/InvoiceDetailsPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
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
            element: <QuotesPage />,
          },
          {
            path: "devis/:quoteId",
            element: <QuoteDetailsPage />,
          },
          {
            path: "clients",
            element: <CustomersPage />,
          },
          {
            path: "clients/archives",
            element: <ArchivedCustomersPage />,
          },
          {
            path: "clients/:customerId",
            element: <CustomerDetailsPage />,
          },
          {
            path: "catalogue",
            element: <ServiceCatalogPage />,
          },
          {
            path: "factures",
            element: <InvoicesPage />,
          },
          {
            path: "factures/:invoiceId",
            element: <InvoiceDetailsPage />,
          },
          {
            path: "parametres",
            element: <SettingsPage />,
          },
        ],
      },
    ],
  },
]);