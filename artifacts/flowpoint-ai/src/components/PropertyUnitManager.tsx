import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, DoorOpen, Loader2, Pencil, Plus, Trash2, UserPlus, Users, X } from 'lucide-react';
import FlowPointSelect from '@/components/FlowPointSelect';
import {
  propertyAddress,
  type Property,
} from '@/lib/propertiesTypes';
import {
  blankUnit,
  formatMoney,
  type Unit,
  type UnitDraft,
  UNIT_TYPES,
  unitTypeLabel,
} from '@/lib/unitsTypes';
import type { Contact, ContactPropertyRelationship } from '@/lib/contactsTypes';

const inputClass = 'w-full h-[39px] rounded-[9px] border border-[#e4e2de] bg-white px-[11px] text-[13px] text-[#151412] outline-none placeholder:text-[#b3b0aa] focus:border-[#151412] focus:ring-2 focus:ring-[#151412]/8 transition-all';
const textAreaClass = 'w-full rounded-[9px] border border-[#e4e2de] bg-white px-[11px] py-[9px] text-[13px] leading-[1.5] text-[#151412] outline-none placeholder:text-[#b3b0aa] focus:border-[#151412] focus:ring-2 focus:ring-[#151412]/8 transition-all resize-none';

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="block"><span className="mb-[5px] block text-[10px] font-semibold uppercase tracking-[.08em] text-[#77736d]">{label}{hint && <span className="ml-1 normal-case font-normal tracking-normal text-[#aaa59d]">{hint}</span>}</span>{children}</label>;
}

function FormError({ message }: { message?: string }) {
  return message ? <p className="mt-1 flex items-center gap-1 text-[11px] text-[#b33d32]"><AlertCircle size={11} />{message}</p> : null;
}

function Modal({ children, onClose, wide = false }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5"><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-[#171511]/30 backdrop-blur-[2px]" /><motion.div initial={{ opacity: 0, y: 10, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .98 }} className={`relative max-h-[94vh] w-full overflow-hidden rounded-[16px] border border-[#e4e2de] bg-[#fbfaf8] shadow-[0_24px_80px_rgba(25,22,18,.18)] ${wide ? 'max-w-[820px]' : 'max-w-[520px]'}`} onClick={(event) => event.stopPropagation()}>{children}</motion.div></div>;
}

type ContactSelection = {
  mode: 'existing' | 'new';
  contact_id: string;
  name: string;
  email: string;
  phone: string;
  contact_type: 'property_owner' | 'company' | 'tenant';
};

export type UnitSavePayload = {
  draft: UnitDraft;
  owner: ContactSelection | null;
  renter: ContactSelection | null;
};

function emptySelection(contactType: ContactSelection['contact_type']): ContactSelection {
  return { mode: 'existing', contact_id: '', name: '', email: '', phone: '', contact_type: contactType };
}

function unitDraftFromUnit(unit: Unit): UnitDraft {
  return {
    property_id: unit.property_id,
    unit_number: unit.unit_number ?? '',
    unit_type: unit.unit_type ?? blankUnit.unit_type,
    description: unit.description ?? '',
    floor: unit.floor,
    bedrooms: unit.bedrooms,
    bathrooms: unit.bathrooms,
    square_footage: unit.square_footage,
    monthly_rent: unit.monthly_rent,
    security_deposit: unit.security_deposit,
    rent_due_day: unit.rent_due_day,
    lease_start_date: unit.lease_start_date,
    lease_end_date: unit.lease_end_date,
    status: unit.status ?? blankUnit.status,
    amenities: unit.amenities ?? '',
    utilities_information: unit.utilities_information ?? '',
    parking_information: unit.parking_information ?? '',
    access_information: unit.access_information ?? '',
    rules: unit.rules ?? '',
    notes: unit.notes ?? '',
  };
}

function scopeMatchesUnit(scope: string | null | undefined, unitNumber: string) {
  if (!scope || !unitNumber.trim()) return false;
  const normalizedUnit = unitNumber.trim().toLowerCase();
  const normalizedScope = scope.toLowerCase();
  if (normalizedScope.includes(normalizedUnit) && /\d/.test(normalizedUnit)) return true;
  const numeric = Number(normalizedUnit);
  if (Number.isNaN(numeric)) return false;
  const ranges: string[] = normalizedScope.match(/\d+\s*(?:-|–|—|to)\s*\d+/g) ?? [];
  if (ranges.some((range) => {
    const [start, end] = range.split(/-|–|—|to/).map((value) => Number(value.trim()));
    return numeric >= start && numeric <= end;
  })) return true;
  const numbers: string[] = normalizedScope.match(/\d+/g) ?? [];
  return numbers.includes(String(numeric));
}

function StatusPill({ status }: { status: string | null | undefined }) {
  const label = status === 'occupied' ? 'Rented' : status === 'vacant' ? 'Not rented' : status ? status[0].toUpperCase() + status.slice(1) : 'Unavailable';
  const tone = status === 'occupied' ? 'bg-[#edf7ef] text-[#327443] border-[#d6ecd9]' : status === 'vacant' ? 'bg-[#eef5fb] text-[#39709c] border-[#d3e4f2]' : 'bg-[#f1f0ee] text-[#77736d] border-[#e1dfda]';
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tone}`}>{label}</span>;
}

function UnitForm({
  property,
  unit,
  units,
  contacts,
  relationships,
  onSave,
  onClose,
}: {
  property: Property;
  unit: Unit | null;
  units: Unit[];
  contacts: Contact[];
  relationships: ContactPropertyRelationship[];
  onSave: (payload: UnitSavePayload) => Promise<void>;
  onClose: () => void;
}) {
  const propertyOwners = relationships.filter((item) => item.property_id === property.id && item.relationship_type === 'owner' && !item.unit_id);
  const unitOwner = relationships.find((item) => item.unit_id === unit?.id && item.relationship_type === 'owner');
  const unitTenant = relationships.find((item) => item.unit_id === unit?.id && item.relationship_type === 'tenant' && !item.end_date);
  const initialOwner = unitOwner ?? (propertyOwners.length === 1 ? propertyOwners[0] : undefined);
  const ownerContact = contacts.find((contact) => String(contact.id) === String(initialOwner?.contact_id));
  const renterContact = contacts.find((contact) => String(contact.id) === String(unitTenant?.contact_id));
  const matchingOwner = propertyOwners.length > 1 && !unitOwner
    ? propertyOwners.find((item) => scopeMatchesUnit(item.ownership_scope, unit?.unit_number ?? ''))
    : undefined;
  const scopedOwnerContact = contacts.find((contact) => String(contact.id) === String(matchingOwner?.contact_id));
  const [form, setForm] = useState<UnitDraft>(() => unit ? unitDraftFromUnit(unit) : { ...blankUnit, property_id: property.id });
  const [owner, setOwner] = useState<ContactSelection>(() => {
    const contact = ownerContact ?? scopedOwnerContact;
    return contact ? { ...emptySelection(contact.contact_type === 'company' ? 'company' : 'property_owner'), contact_id: String(contact.id), name: contact.name } : emptySelection('property_owner');
  });
  const [renter, setRenter] = useState<ContactSelection>(() => renterContact ? { ...emptySelection('tenant'), contact_id: String(renterContact.id), name: renterContact.name } : emptySelection('tenant'));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (key: keyof UnitDraft, value: string | number | null) => setForm((current) => ({ ...current, [key]: value }));
  const apartmentCount = units.filter((item) => item.unit_type === 'apartment' && item.id !== unit?.id).length;
  const apartmentLimit = property.units_count;
  const ownerOptions = contacts.filter((contact) => ['property_owner', 'company', 'former_owner', 'other'].includes(contact.contact_type ?? '') || String(contact.id) === owner.contact_id);
  const renterOptions = contacts.filter((contact) => ['tenant', 'former_tenant', 'other'].includes(contact.contact_type ?? '') || String(contact.id) === renter.contact_id);
  const unitTypeOptions = UNIT_TYPES.filter((type) => type.value !== 'commercial' && (type.value === 'apartment' || type.value === 'other' || type.value === form.unit_type));

  useEffect(() => {
    if (unit || owner.contact_id || owner.mode === 'new' || propertyOwners.length <= 1) return;
    const matched = propertyOwners.find((item) => scopeMatchesUnit(item.ownership_scope, form.unit_number));
    const matchedContact = contacts.find((contact) => String(contact.id) === String(matched?.contact_id));
    if (matchedContact) setOwner((current) => ({ ...current, contact_id: String(matchedContact.id), name: matchedContact.name, contact_type: matchedContact.contact_type === 'company' ? 'company' : 'property_owner' }));
  }, [form.unit_number, unit, owner.contact_id, owner.mode, propertyOwners, contacts]);

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!form.unit_number.trim()) next.unit_number = 'Unit number or name is required';
    if (form.unit_type === 'apartment' && apartmentLimit !== null && apartmentCount >= apartmentLimit && !unit) next.unit_type = `This property already has its ${apartmentLimit} apartments. Add a shared space instead.`;
    if (form.floor !== null && (Number.isNaN(form.floor) || form.floor < 0)) next.floor = 'Enter zero or more';
    if (form.bedrooms !== null && (Number.isNaN(form.bedrooms) || form.bedrooms < 0)) next.bedrooms = 'Enter zero or more';
    if (form.bathrooms !== null && (Number.isNaN(form.bathrooms) || form.bathrooms < 0)) next.bathrooms = 'Enter zero or more';
    if (form.square_footage !== null && (Number.isNaN(form.square_footage) || form.square_footage < 0)) next.square_footage = 'Enter zero or more';
    if (form.monthly_rent !== null && (Number.isNaN(form.monthly_rent) || form.monthly_rent < 0)) next.monthly_rent = 'Enter zero or more';
    if (form.security_deposit !== null && (Number.isNaN(form.security_deposit) || form.security_deposit < 0)) next.security_deposit = 'Enter zero or more';
    if (form.rent_due_day !== null && (Number.isNaN(form.rent_due_day) || form.rent_due_day < 1 || form.rent_due_day > 31)) next.rent_due_day = 'Use a day from 1 to 31';
    if (form.lease_start_date && form.lease_end_date && form.lease_end_date < form.lease_start_date) next.lease_end_date = 'End date must be on or after the start date';
    if (form.status === 'occupied') {
      if (renter.mode === 'existing' && !renter.contact_id) next.renter = 'Choose the renter contact';
      if (renter.mode === 'new' && !renter.name.trim()) next.renter = 'Renter name is required';
      if (renter.mode === 'new' && !renter.email.trim() && !renter.phone.trim()) next.renter = 'Add an email or phone for the renter';
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      await onSave({
        draft: { ...form, unit_number: form.unit_number.trim(), description: form.description?.trim() || null, amenities: form.amenities?.trim() || null, utilities_information: form.utilities_information?.trim() || null, parking_information: form.parking_information?.trim() || null, access_information: form.access_information?.trim() || null, rules: form.rules?.trim() || null, notes: form.notes?.trim() || null, lease_start_date: form.lease_start_date || null, lease_end_date: form.lease_end_date || null },
        owner: owner.contact_id || owner.mode === 'new' && owner.name.trim() ? owner : null,
        renter: form.status === 'occupied' ? renter : null,
      });
      onClose();
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : 'Unable to save unit' });
      setSaving(false);
    }
  };

  return <Modal onClose={onClose} wide>
    <div className="flex items-center justify-between border-b border-[#ebe8e3] px-5 py-4"><div><p className="text-[15px] font-semibold text-[#151412]">{unit ? 'Edit unit' : 'Add unit'} in {property.name}</p><p className="mt-1 text-[11px] text-[#8b877f]">Owners, rental state, and lease details stay connected to this unit.</p></div><button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full border border-[#e4e2de] text-[#817d76]"><X size={14} /></button></div>
    <div className="max-h-[calc(94vh-72px)] overflow-y-auto px-5 py-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Unit number / name"><input autoFocus className={inputClass} value={form.unit_number} onChange={(event) => set('unit_number', event.target.value)} placeholder="e.g. 3 or Gym" /><FormError message={errors.unit_number} /></Field>
        <Field label="Unit type"><FlowPointSelect value={form.unit_type ?? ''} onChange={(value) => set('unit_type', value)} placeholder="Select a type" options={unitTypeOptions.map((type) => ({ value: type.value, label: type.value === 'other' ? 'Shared space / other' : type.label }))} /><FormError message={errors.unit_type} /></Field>
        <Field label="Floor" hint="optional"><input type="number" min="0" step="1" className={inputClass} value={form.floor ?? ''} onChange={(event) => set('floor', event.target.value === '' ? null : Number(event.target.value))} placeholder="e.g. 2" /><FormError message={errors.floor} /></Field>
        <Field label="Square footage" hint="optional"><input type="number" min="0" step="1" className={inputClass} value={form.square_footage ?? ''} onChange={(event) => set('square_footage', event.target.value === '' ? null : Number(event.target.value))} placeholder="e.g. 850" /><FormError message={errors.square_footage} /></Field>
        <Field label="Bedrooms" hint="optional"><input type="number" min="0" step="0.5" className={inputClass} value={form.bedrooms ?? ''} onChange={(event) => set('bedrooms', event.target.value === '' ? null : Number(event.target.value))} placeholder="e.g. 2" /></Field>
        <Field label="Bathrooms" hint="optional"><input type="number" min="0" step="0.5" className={inputClass} value={form.bathrooms ?? ''} onChange={(event) => set('bathrooms', event.target.value === '' ? null : Number(event.target.value))} placeholder="e.g. 1.5" /></Field>
        <div className="sm:col-span-2"><Field label="Description" hint="optional"><textarea className={textAreaClass} rows={2} value={form.description ?? ''} onChange={(event) => set('description', event.target.value)} placeholder="A short description for your team" /></Field></div>
      </div>

      <section className="mt-6 border-t border-[#ebe8e3] pt-5"><div className="mb-3"><p className="text-[12px] font-semibold text-[#35322e]">Ownership</p><p className="mt-1 text-[11px] text-[#9c978e]">{propertyOwners.length === 1 ? 'This owner is inherited from the property.' : 'Choose the owner for this unit, or add a new owner contact.'}</p></div>
        <div className="flex gap-1 rounded-[8px] bg-[#f5f3f0] p-1"><button type="button" onClick={() => setOwner((current) => ({ ...current, mode: 'existing' }))} className={`flex-1 rounded-[6px] px-2 py-1.5 text-[10px] font-semibold ${owner.mode === 'existing' ? 'bg-white text-[#35322e] shadow-sm' : 'text-[#8f8981]'}`}>Choose existing contact</button><button type="button" onClick={() => setOwner((current) => ({ ...current, mode: 'new', contact_id: '' }))} className={`flex-1 rounded-[6px] px-2 py-1.5 text-[10px] font-semibold ${owner.mode === 'new' ? 'bg-white text-[#35322e] shadow-sm' : 'text-[#8f8981]'}`}>Add new owner contact</button></div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">{owner.mode === 'existing' ? <Field label="Owner"><FlowPointSelect value={owner.contact_id} onChange={(value) => setOwner((current) => ({ ...current, contact_id: value }))} placeholder="Select owner" options={ownerOptions.map((contact) => ({ value: String(contact.id), label: contact.name, secondary: contact.company_name ?? contact.customer_id ?? contact.email ?? undefined }))} emptyLabel="No owner contacts yet. Add one instead." /></Field> : <><Field label="Owner / company name"><input className={inputClass} value={owner.name} onChange={(event) => setOwner((current) => ({ ...current, name: event.target.value }))} placeholder="Person or company name" /></Field><Field label="Entity type"><FlowPointSelect value={owner.contact_type} onChange={(value) => setOwner((current) => ({ ...current, contact_type: value as ContactSelection['contact_type'] }))} placeholder="Choose entity type" options={[{ value: 'property_owner', label: 'Person' }, { value: 'company', label: 'Company' }]} /></Field><Field label="Email" hint="optional"><input type="email" className={inputClass} value={owner.email} onChange={(event) => setOwner((current) => ({ ...current, email: event.target.value }))} placeholder="owner@example.com" /></Field><Field label="Phone" hint="optional"><input className={inputClass} value={owner.phone} onChange={(event) => setOwner((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone number" /></Field></>}</div>
        <FormError message={errors.owner} />
      </section>

      <section className="mt-6 border-t border-[#ebe8e3] pt-5"><div className="mb-3"><p className="text-[12px] font-semibold text-[#35322e]">Rental status</p><p className="mt-1 text-[11px] text-[#9c978e]">Rented units require the renter and current lease window.</p></div><Field label="Status"><FlowPointSelect value={form.status ?? ''} onChange={(value) => set('status', value)} options={[{ value: 'vacant', label: 'Not rented' }, { value: 'occupied', label: 'Rented' }, { value: 'maintenance', label: 'Maintenance' }, { value: 'unavailable', label: 'Unavailable' }]} placeholder="Choose a status" /></Field>
        {form.status === 'occupied' && <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><div className="flex gap-1 rounded-[8px] bg-[#f5f3f0] p-1"><button type="button" onClick={() => setRenter((current) => ({ ...current, mode: 'existing' }))} className={`flex-1 rounded-[6px] px-2 py-1.5 text-[10px] font-semibold ${renter.mode === 'existing' ? 'bg-white text-[#35322e] shadow-sm' : 'text-[#8f8981]'}`}>Choose existing renter</button><button type="button" onClick={() => setRenter((current) => ({ ...current, mode: 'new', contact_id: '' }))} className={`flex-1 rounded-[6px] px-2 py-1.5 text-[10px] font-semibold ${renter.mode === 'new' ? 'bg-white text-[#35322e] shadow-sm' : 'text-[#8f8981]'}`}>Add new renter contact</button></div></div>{renter.mode === 'existing' ? <Field label="Renter"><FlowPointSelect value={renter.contact_id} onChange={(value) => setRenter((current) => ({ ...current, contact_id: value }))} placeholder="Select renter" options={renterOptions.map((contact) => ({ value: String(contact.id), label: contact.name, secondary: contact.customer_id ?? contact.email ?? contact.phone ?? undefined }))} emptyLabel="No renter contacts yet. Add one instead." /></Field> : <><Field label="Renter name"><input className={inputClass} value={renter.name} onChange={(event) => setRenter((current) => ({ ...current, name: event.target.value }))} placeholder="Full name" /></Field><Field label="Email" hint="optional"><input type="email" className={inputClass} value={renter.email} onChange={(event) => setRenter((current) => ({ ...current, email: event.target.value }))} placeholder="renter@example.com" /></Field><Field label="Phone" hint="optional"><input className={inputClass} value={renter.phone} onChange={(event) => setRenter((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone number" /></Field></>}<Field label="Monthly rent"><input type="number" min="0" step="0.01" className={inputClass} value={form.monthly_rent ?? ''} onChange={(event) => set('monthly_rent', event.target.value === '' ? null : Number(event.target.value))} placeholder="0.00" /><FormError message={errors.monthly_rent} /></Field><Field label="Security deposit" hint="optional"><input type="number" min="0" step="0.01" className={inputClass} value={form.security_deposit ?? ''} onChange={(event) => set('security_deposit', event.target.value === '' ? null : Number(event.target.value))} placeholder="0.00" /></Field><Field label="Lease start"><input type="date" className={inputClass} value={form.lease_start_date ?? ''} onChange={(event) => set('lease_start_date', event.target.value || null)} /></Field><Field label="Lease end"><input type="date" className={inputClass} value={form.lease_end_date ?? ''} onChange={(event) => set('lease_end_date', event.target.value || null)} /><FormError message={errors.lease_end_date} /></Field><Field label="Rent due day" hint="optional"><input type="number" min="1" max="31" className={inputClass} value={form.rent_due_day ?? ''} onChange={(event) => set('rent_due_day', event.target.value === '' ? null : Number(event.target.value))} placeholder="1" /><FormError message={errors.rent_due_day} /></Field><FormError message={errors.renter} /></div>}
      </section>

      <section className="mt-6 border-t border-[#ebe8e3] pt-5"><p className="text-[12px] font-semibold text-[#35322e]">Unit notes</p><div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="Amenities" hint="optional"><textarea className={textAreaClass} rows={2} value={form.amenities ?? ''} onChange={(event) => set('amenities', event.target.value)} placeholder="Pool, balcony, laundry..." /></Field><Field label="Utilities" hint="optional"><textarea className={textAreaClass} rows={2} value={form.utilities_information ?? ''} onChange={(event) => set('utilities_information', event.target.value)} placeholder="Included utilities or providers" /></Field><Field label="Parking" hint="optional"><textarea className={textAreaClass} rows={2} value={form.parking_information ?? ''} onChange={(event) => set('parking_information', event.target.value)} placeholder="Space, permit, or restrictions" /></Field><Field label="Notes" hint="optional"><textarea className={textAreaClass} rows={2} value={form.notes ?? ''} onChange={(event) => set('notes', event.target.value)} placeholder="Private notes for your team" /></Field></div></section>
      {errors.form && <div className="mt-4 flex items-start gap-2 rounded-[9px] border border-[#f0c8c3] bg-[#fff7f6] px-3 py-2.5 text-[12px] text-[#a33a30]"><AlertCircle size={14} className="mt-0.5 flex-shrink-0" />{errors.form}</div>}
      <div className="mt-5 flex justify-end gap-2 border-t border-[#ebe8e3] pt-4"><button onClick={onClose} disabled={saving} className="h-9 rounded-[9px] border border-[#e4e2de] px-4 text-[12px] font-medium text-[#625e57]">Cancel</button><button onClick={submit} disabled={saving} className="flex h-9 items-center gap-2 rounded-[9px] bg-[#151412] px-4 text-[12px] font-semibold text-white disabled:opacity-50">{saving && <Loader2 size={13} className="animate-spin" />}{unit ? 'Save changes' : 'Add unit'}</button></div>
    </div>
  </Modal>;
}

export default function PropertyUnitManager({
  property,
  units,
  contacts,
  relationships,
  onSave,
  onDelete,
}: {
  property: Property;
  units: Unit[];
  contacts: Contact[];
  relationships: ContactPropertyRelationship[];
  onSave: (payload: UnitSavePayload, existingUnit: Unit | null) => Promise<void>;
  onDelete: (unit: Unit) => Promise<void>;
}) {
  const [formUnit, setFormUnit] = useState<Unit | null | undefined>(undefined);
  const canHaveUnits = property.property_type === 'apartment_building';
  const propertyUnits = units.filter((unit) => unit.property_id === property.id).sort((a, b) => a.unit_number.localeCompare(b.unit_number, undefined, { numeric: true }));
  const apartmentCount = propertyUnits.filter((unit) => unit.unit_type === 'apartment').length;
  const owners = relationships.filter((item) => item.property_id === property.id && item.relationship_type === 'owner' && !item.unit_id);
  const tenantsByUnit = useMemo(() => new Map(relationships.filter((item) => item.relationship_type === 'tenant' && item.unit_id).map((item) => [item.unit_id as string, contacts.find((contact) => String(contact.id) === String(item.contact_id))?.name ?? 'Renter unavailable'])), [relationships, contacts]);
  if (!canHaveUnits) return <div className="mt-4 rounded-[11px] border border-dashed border-[#dedad3] bg-[#faf9f7] px-4 py-3 text-[11px] text-[#97928a]">Units are only available for building properties. This property is managed as a single record.</div>;
  return <div className="mt-4 border-t border-[#f0eeeb] pt-3">
    <div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#77736d]">Units</p><p className="mt-1 text-[10px] text-[#aaa59d]">{propertyUnits.length} added · {property.units_count ?? 'No'} apartment limit · {owners.length === 1 ? 'Owner inherited from property' : 'Unit ownership available'}</p></div><button onClick={() => setFormUnit(null)} className="flex h-8 items-center gap-1.5 rounded-[8px] bg-[#151412] px-3 text-[11px] font-semibold text-white"><Plus size={12} />Add unit</button></div>
    {propertyUnits.length === 0 ? <div className="mt-3 rounded-[10px] border border-dashed border-[#d9d5ce] px-4 py-5 text-center text-[11px] text-[#97928a]">No units yet. Add apartments up to the property limit, or add shared spaces such as a gym or parking area.</div> : <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{propertyUnits.map((unit) => <div key={unit.id} className="rounded-[10px] border border-[#eeeae5] bg-[#faf9f7] p-3"><div className="flex items-start justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[8px] bg-[#eeebe5] text-[#706b62]"><DoorOpen size={14} /></div><div className="min-w-0"><p className="truncate text-[12px] font-semibold text-[#35322e]">{unit.unit_number}</p><p className="text-[10px] text-[#97928a]">{unitTypeLabel(unit.unit_type)}</p></div></div><StatusPill status={unit.status} /></div><div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#eeeae5] pt-2 text-[10px]"><div><p className="text-[#aaa59d]">Owner</p><p className="mt-0.5 truncate text-[#625e57]">{contacts.find((contact) => String(contact.id) === String(relationships.find((item) => item.unit_id === unit.id && item.relationship_type === 'owner')?.contact_id))?.name ?? (owners.length === 1 ? contacts.find((contact) => String(contact.id) === String(owners[0].contact_id))?.name ?? 'Property owner' : 'Not assigned')}</p></div><div><p className="text-[#aaa59d]">Renter</p><p className="mt-0.5 truncate text-[#625e57]">{tenantsByUnit.get(unit.id) ?? 'Not rented'}</p></div></div><div className="mt-3 flex justify-end gap-1.5"><button onClick={() => setFormUnit(unit)} className="flex h-7 items-center gap-1 rounded-[7px] border border-[#e0ddd7] bg-white px-2 text-[10px] font-semibold text-[#625e57]"><Pencil size={11} />Edit</button><button onClick={() => { if (window.confirm(`Delete unit ${unit.unit_number}?`)) void onDelete(unit); }} className="flex h-7 items-center gap-1 rounded-[7px] border border-[#efd0cc] bg-white px-2 text-[10px] font-semibold text-[#a33a30]"><Trash2 size={11} />Delete</button></div></div>)}</div>}
    <AnimatePresence>{formUnit !== undefined && <UnitForm key={`${formUnit?.id ?? 'new'}-${property.id}`} property={property} unit={formUnit} units={propertyUnits} contacts={contacts} relationships={relationships} onSave={(payload) => onSave(payload, formUnit)} onClose={() => setFormUnit(undefined)} />}</AnimatePresence>
  </div>;
}