export type ProjectStatus = "lead" | "planned" | "in_progress" | "completed" | "archived";

export type Project = {
  id: string;
  company_id: string;
  customer_id: string;
  name: string;
  status: ProjectStatus;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string;
  start_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectCustomer = {
  id: string;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

export function getProjectStatusLabel(status: ProjectStatus) {
  const labels: Record<ProjectStatus, string> = {
    lead: "À qualifier",
    planned: "Planifié",
    in_progress: "En cours",
    completed: "Terminé",
    archived: "Archivé",
  };
  return labels[status];
}

export function getProjectCustomerName(customer?: ProjectCustomer) {
  if (!customer) return "Client inconnu";
  return customer.company_name || [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Client sans nom";
}
