import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./features/auth/hooks/useAuth";
import { CatalogTaxonomyProvider } from "./features/catalog/CatalogTaxonomyContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <CatalogTaxonomyProvider>
        <App />
      </CatalogTaxonomyProvider>
    </AuthProvider>
  </React.StrictMode>
);
