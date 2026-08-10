import { supabase } from "../../lib/supabase";
import type { Project, ProjectCustomer, ProjectStatus } from "./types";

export type CreateProjectInput = {
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
};

export async function listProjects() {
  const { data, error } = await supabase
    .from("projects")
    .select("id, company_id, customer_id, name, status, address_line1, address_line2, postal_code, city, country, start_date, notes, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Project[];
}

export async function listProjectCustomers() {
  const { data, error } = await supabase
    .from("customers")
    .select("id, company_name, first_name, last_name")
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProjectCustomer[];
}

export async function listCompaniesForProjects() {
  const { data, error } = await supabase.from("companies").select("id, name").order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function createProject(input: CreateProjectInput) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw authError ?? new Error("Utilisateur non connecté.");

  const { data, error } = await supabase
    .from("projects")
    .insert({ ...input, created_by: authData.user.id })
    .select("id, company_id, customer_id, name, status, address_line1, address_line2, postal_code, city, country, start_date, notes, created_at, updated_at")
    .single();
  if (error) throw error;
  return data as Project;
}

export async function getProject(projectId: string) {
  const { data, error } = await supabase
    .from("projects")
    .select("id, company_id, customer_id, name, status, address_line1, address_line2, postal_code, city, country, start_date, notes, created_at, updated_at")
    .eq("id", projectId)
    .single();
  if (error) throw error;
  return data as Project;
}

export async function updateProjectStatus(projectId: string, status: ProjectStatus) {
  const { error } = await supabase.from("projects").update({ status }).eq("id", projectId);
  if (error) throw error;
}
