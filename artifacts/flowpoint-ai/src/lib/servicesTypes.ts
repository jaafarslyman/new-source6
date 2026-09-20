export type ServiceStatus = 'active' | 'inactive';

export interface Service {
  id: string;
  company_id: string | null;
  created_at: string;
  updated_at: string;
  name: string;
  category: string;
  short_description: string | null;
  description: string | null;
  customer_facing_description: string | null;
  requirements: string | null;
  included_details: string | null;
  excluded_details: string | null;
  pricing_information: string | null;
  availability_information: string | null;
  typical_response_time: string | null;
  internal_instructions: string | null;
  escalation_instructions: string | null;
  status: ServiceStatus;
}

export type ServiceDraft = Omit<Service, 'id' | 'company_id' | 'created_at' | 'updated_at'>;

export interface ServiceContactRelationship {
  id: string | number;
  company_id: string | null;
  service_id: string;
  contact_id: number | string;
  relationship_status: string | null;
  notes: string | null;
  contact?: {
    id: number | string;
    name: string;
    customer_id: string | null;
    contact_type: string | null;
    status: string | null;
  } | null;
  service?: {
    id: string;
    name: string;
    category: string;
    status: string;
  } | null;
}

export interface ServiceStaffRelationship {
  id: string | number;
  company_id: string | null;
  service_id: string;
  staff_id: number | string;
  assignment_role: string | null;
  notes: string | null;
  staff?: {
    id: number | string;
    name: string;
    role: string | null;
    department: string | null;
    status: string | null;
  } | null;
}

export interface ServicePropertyRelationship {
  id: string | number;
  company_id: string | null;
  service_id: string;
  property_id: string;
  notes: string | null;
  property?: {
    id: string;
    name: string;
    city: string | null;
    address_line1: string | null;
  } | null;
}

export interface ServiceUnitRelationship {
  id: string | number;
  company_id: string | null;
  service_id: string;
  unit_id: string;
  notes: string | null;
  unit?: {
    id: string;
    unit_number: string;
    property_id: string;
    property?: {
      id: string;
      name: string;
    } | null;
  } | null;
}

export const SERVICE_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
] as const;

export function serviceStatusLabel(value: string | null | undefined) {
  return SERVICE_STATUSES.find((item) => item.value === value)?.label ?? 'Inactive';
}