export interface Unit {
  id: string;
  company_id: string | null;
  property_id: string;
  created_at: string;
  updated_at: string;
  unit_number: string;
  unit_type: string | null;
  description: string | null;
  floor: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_footage: number | null;
  monthly_rent: number | null;
  security_deposit: number | null;
  rent_due_day: number | null;
  lease_start_date: string | null;
  lease_end_date: string | null;
  status: string | null;
  amenities: string | null;
  utilities_information: string | null;
  parking_information: string | null;
  access_information: string | null;
  rules: string | null;
  notes: string | null;
}

export type UnitDraft = Omit<Unit, 'id' | 'company_id' | 'created_at' | 'updated_at'>;

export const UNIT_TYPES = [
  { value: 'apartment', label: 'Apartment' },
  { value: 'house', label: 'House' },
  { value: 'condo', label: 'Condo' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'other', label: 'Other' },
] as const;

export const UNIT_STATUSES = [
  { value: 'occupied', label: 'Occupied' },
  { value: 'vacant', label: 'Vacant' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'unavailable', label: 'Unavailable' },
] as const;

export function unitTypeLabel(value: string | null | undefined) {
  return UNIT_TYPES.find((type) => type.value === value)?.label ?? value ?? 'Type unavailable';
}

export function unitStatusLabel(value: string | null | undefined) {
  return UNIT_STATUSES.find((status) => status.value === value)?.label ?? value ?? 'Unavailable';
}

export const blankUnit: UnitDraft = {
  property_id: '',
  unit_number: '',
  unit_type: 'apartment',
  description: '',
  floor: null,
  bedrooms: null,
  bathrooms: null,
  square_footage: null,
  monthly_rent: null,
  security_deposit: null,
  rent_due_day: 1,
  lease_start_date: null,
  lease_end_date: null,
  status: 'vacant',
  amenities: '',
  utilities_information: '',
  parking_information: '',
  access_information: '',
  rules: '',
  notes: '',
};

export function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(year, month - 1, day));
}