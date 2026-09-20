export interface Property {
  id: string;
  company_id: string | null;
  created_at: string;
  updated_at: string;
  name: string;
  property_type: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  description: string | null;
  units_count: number | null;
  amenities: string | null;
  property_rules: string | null;
  parking_information: string | null;
  access_information: string | null;
  utilities_information: string | null;
  emergency_information: string | null;
  notes: string | null;
  status: string | null;
}

export type PropertyDraft = Omit<Property, 'id' | 'company_id' | 'created_at' | 'updated_at'>;

export const PROPERTY_TYPES = [
  { value: 'apartment_building', label: 'Apartment building' },
  { value: 'single_family', label: 'Single-family' },
  { value: 'condo', label: 'Condo' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'mixed_use', label: 'Mixed-use' },
  { value: 'other', label: 'Other' },
] as const;

export const PROPERTY_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
] as const;

export function propertyTypeLabel(value: string | null | undefined) {
  return PROPERTY_TYPES.find((type) => type.value === value)?.label ?? value ?? 'Type unavailable';
}

export function propertyStatusLabel(value: string | null | undefined) {
  return PROPERTY_STATUSES.find((status) => status.value === value)?.label ?? value ?? 'Unavailable';
}

export const blankProperty: PropertyDraft = {
  name: '',
  property_type: 'apartment_building',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'United States',
  description: '',
  units_count: null,
  amenities: '',
  property_rules: '',
  parking_information: '',
  access_information: '',
  utilities_information: '',
  emergency_information: '',
  notes: '',
  status: 'active',
};

export function propertyAddress(property: Property) {
  return [property.address_line1, property.city, property.state, property.postal_code]
    .filter(Boolean)
    .join(', ');
}