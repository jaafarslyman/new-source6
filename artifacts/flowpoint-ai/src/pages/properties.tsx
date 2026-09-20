import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle, Building2, Check, ChevronDown, ChevronRight, Filter, Loader2,
  MapPin, Pencil, Plus, RefreshCw, Search, Trash2, UserPlus, UserRound, Users, X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import FlowPointSelect from '@/components/FlowPointSelect';
import PropertyProfileModal from '@/components/PropertyProfileModal';
import PropertyUnitManager, { type UnitSavePayload } from '@/components/PropertyUnitManager';
import { supabase } from '@/lib/supabase';
import {
  blankProperty, propertyStatusLabel, propertyTypeLabel, PROPERTY_STATUSES, PROPERTY_TYPES, propertyAddress,
  type Property, type PropertyDraft,
} from '@/lib/propertiesTypes';
import type { Contact, ContactPropertyRelationship } from '@/lib/contactsTypes';
import type { Unit } from '@/lib/unitsTypes';

const inputClass = 'w-full h-[39px] rounded-[9px] border border-[#e4e2de] bg-white px-[11px] text-[13px] text-[#151412] outline-none placeholder:text-[#b3b0aa] focus:border-[#151412] focus:ring-2 focus:ring-[#151412]/8 transition-all';
const textAreaClass = 'w-full rounded-[9px] border border-[#e4e2de] bg-white px-[11px] py-[9px] text-[13px] leading-[1.5] text-[#151412] outline-none placeholder:text-[#b3b0aa] focus:border-[#151412] focus:ring-2 focus:ring-[#151412]/8 transition-all resize-none';

function Modal({ children, onClose, wide = false }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-[#171511]/30 backdrop-blur-[2px]" />
      <motion.div initial={{ opacity: 0, y: 10, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .98 }} className={`relative max-h-[92vh] w-full overflow-hidden rounded-[16px] border border-[#e4e2de] bg-[#fbfaf8] shadow-[0_24px_80px_rgba(25,22,18,.18)] ${wide ? 'max-w-[720px]' : 'max-w-[520px]'}`} onClick={(event) => event.stopPropagation()}>
        {children}
      </motion.div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="block"><span className="mb-[5px] block text-[10px] font-semibold uppercase tracking-[.08em] text-[#77736d]">{label}{hint && <span className="ml-1 normal-case font-normal tracking-normal text-[#aaa59d]">{hint}</span>}</span>{children}</label>;
}

function FormError({ message }: { message?: string | null }) {
  return message ? <p className="mt-1 flex items-center gap-1 text-[11px] text-[#b33d32]"><AlertCircle size={11} />{message}</p> : null;
}

function ConfirmDelete({ name, deleting, onCancel, onConfirm }: { name: string; deleting: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={deleting ? undefined : onCancel} className="absolute inset-0 bg-[#171511]/30 backdrop-blur-[2px]" /><motion.div initial={{ opacity: 0, y: 8, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="relative w-full max-w-[380px] rounded-[16px] border border-[#e4e2de] bg-[#fbfaf8] p-6 text-center shadow-[0_24px_80px_rgba(25,22,18,.18)]"><div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-[#f0cbc6] bg-[#fff3f1] text-[#b33d32]"><Trash2 size={17} /></div><h2 className="mt-4 text-[15px] font-semibold text-[#24211e]">Delete {name}?</h2><p className="mt-1 text-[12px] leading-[1.5] text-[#8f8980]">This property record will be permanently removed. This action cannot be undone.</p><div className="mt-5 flex gap-2"><button data-testid="button-cancel-delete-property" onClick={onCancel} disabled={deleting} className="h-9 flex-1 rounded-[9px] border border-[#e4e2de] text-[12px] font-medium text-[#625e57] hover:bg-[#f0eeea] disabled:opacity-50">Cancel</button><button data-testid="button-confirm-delete-property" onClick={onConfirm} disabled={deleting} className="flex h-9 flex-1 items-center justify-center gap-2 rounded-[9px] bg-[#b33d32] text-[12px] font-semibold text-white hover:bg-[#96342b] disabled:opacity-50">{deleting && <Loader2 size={13} className="animate-spin" />}Delete property</button></div></motion.div></div>;
}

export type OwnershipBasis = 'percentage' | 'scope';
type OwnershipStructure = 'single' | 'multiple';

export type OwnerDraft = {
  id?: string | number;
  contact_id: string;
  source: 'existing' | 'new';
  name: string;
  email: string;
  phone: string;
  contact_type?: 'property_owner' | 'company';
  ownership_percentage: string;
  ownership_scope: string;
};

function ownerDraftFromRelationship(relationship: ContactPropertyRelationship, contact?: Contact): OwnerDraft {
  return {
    id: relationship.id,
    contact_id: String(relationship.contact_id),
    source: 'existing',
    name: contact?.name ?? '',
    email: '',
    phone: '',
    contact_type: 'property_owner',
    ownership_percentage: relationship.ownership_percentage === null || relationship.ownership_percentage === undefined
      ? ''
      : String(relationship.ownership_percentage),
    ownership_scope: relationship.ownership_scope ?? '',
  };
}

function blankOwnerDraft(): OwnerDraft {
  return {
    source: 'new',
    contact_id: '',
    name: '',
    email: '',
    phone: '',
    ownership_percentage: '',
    ownership_scope: '',
  };
}

export function PropertyForm({
  property,
  contacts,
  ownerships,
  onSave,
  onClose,
}: {
  property: Property | null;
  contacts: Contact[];
  ownerships: ContactPropertyRelationship[];
  onSave: (draft: PropertyDraft, owners: OwnerDraft[], basis: OwnershipBasis) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<PropertyDraft>(() => property ? {
    name: property.name ?? '', property_type: property.property_type ?? blankProperty.property_type,
    address_line1: property.address_line1 ?? '', address_line2: property.address_line2 ?? '',
    city: property.city ?? '', state: property.state ?? '', postal_code: property.postal_code ?? '',
    country: property.country ?? 'United States', description: property.description ?? '',
    units_count: property.units_count, amenities: property.amenities ?? '',
    property_rules: property.property_rules ?? '', parking_information: property.parking_information ?? '',
    access_information: property.access_information ?? '', utilities_information: property.utilities_information ?? '',
    emergency_information: property.emergency_information ?? '', notes: property.notes ?? '',
    status: property.status ?? blankProperty.status,
  } : blankProperty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(Boolean(property));
  const existingOwners = ownerships.filter((relationship) => relationship.property_id === property?.id && relationship.relationship_type === 'owner' && !relationship.unit_id);
  const [ownershipStructure, setOwnershipStructure] = useState<OwnershipStructure>(() => existingOwners.length > 1 ? 'multiple' : 'single');
  const [ownershipBasis, setOwnershipBasis] = useState<OwnershipBasis>(() => existingOwners.some((owner) => owner.ownership_percentage !== null) ? 'percentage' : 'scope');
  const [owners, setOwners] = useState<OwnerDraft[]>(() => existingOwners.length
    ? existingOwners.map((relationship) => ownerDraftFromRelationship(relationship, contacts.find((contact) => contact.id === relationship.contact_id)))
    : [blankOwnerDraft()]);
  const set = (key: keyof PropertyDraft, value: string | number | null) => setForm((current) => ({ ...current, [key]: value }));
  const updateOwner = (index: number, patch: Partial<OwnerDraft>) => {
    setOwners((current) => current.map((owner, ownerIndex) => ownerIndex === index ? { ...owner, ...patch } : owner));
  };

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Property name is required';
    if (!form.address_line1?.trim()) next.address_line1 = 'Address is required';
    if (!form.city?.trim()) next.city = 'City is required';
    if (!form.country?.trim()) next.country = 'Country is required';
    if (form.property_type === 'apartment_building' && (form.units_count === null || Number.isNaN(form.units_count) || form.units_count < 0)) next.units_count = 'Enter the apartment limit for this building';
    if (!owners.length) next.owners = 'Add at least one owner';
    const contactKeys = new Set<string>();
    owners.forEach((owner, index) => {
      if (owner.source === 'existing') {
        if (!owner.contact_id) next[`owner_${index}`] = 'Select an existing contact';
        if (owner.contact_id && contactKeys.has(owner.contact_id)) next[`owner_${index}`] = 'Each owner can only be added once';
        if (owner.contact_id) contactKeys.add(owner.contact_id);
      } else {
        if (!owner.name.trim()) next[`owner_${index}`] = 'Owner name is required';
        if (!owner.email.trim() && !owner.phone.trim()) next[`owner_${index}`] = 'Add an email or phone so this person can be added as a contact';
        if (owner.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner.email.trim())) next[`owner_${index}`] = 'Enter a valid email';
      }
      if (ownershipBasis === 'percentage') {
        const percentage = Number(owner.ownership_percentage);
        if (!owner.ownership_percentage.trim() || Number.isNaN(percentage) || percentage < 0 || percentage > 100) {
          next[`owner_${index}`] = 'Enter a percentage from 0 to 100';
        }
      } else if (!owner.ownership_scope.trim()) {
        next[`owner_${index}`] = 'Describe what this owner owns inside the property';
      }
    });
    if (ownershipBasis === 'percentage' && owners.length && owners.every((owner) => owner.ownership_percentage.trim() && !Number.isNaN(Number(owner.ownership_percentage)))) {
      const total = owners.reduce((sum, owner) => sum + Number(owner.ownership_percentage), 0);
      if (Math.abs(total - 100) > 0.01) next.owners = `Owner percentages must total 100% (currently ${total}%).`;
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true); setSaveError(null);
    try {
      await onSave({
        ...form,
        name: form.name.trim(),
        address_line1: form.address_line1?.trim() ?? '',
        units_count: form.property_type === 'apartment_building' && form.units_count !== null ? Number(form.units_count) : null,
        address_line2: form.address_line2?.trim() || null,
        city: form.city?.trim() || null, state: form.state?.trim() || null,
        postal_code: form.postal_code?.trim() || null, country: form.country?.trim() || null,
        description: form.description?.trim() || null, amenities: form.amenities?.trim() || null,
        property_rules: form.property_rules?.trim() || null, parking_information: form.parking_information?.trim() || null,
        access_information: form.access_information?.trim() || null, utilities_information: form.utilities_information?.trim() || null,
        emergency_information: form.emergency_information?.trim() || null, notes: form.notes?.trim() || null,
      }, owners.map((owner) => ({
        ...owner,
        name: owner.name.trim(),
        email: owner.email.trim(),
        phone: owner.phone.trim(),
        ownership_percentage: ownershipBasis === 'percentage' ? owner.ownership_percentage.trim() : '',
        ownership_scope: ownershipBasis === 'scope' ? owner.ownership_scope.trim() : '',
      })), ownershipBasis);
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save property');
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} wide>
      <div className="flex items-center justify-between border-b border-[#ebe8e3] px-5 py-4">
        <div><p className="text-[15px] font-semibold text-[#151412]">{property ? 'Edit property' : 'Add property'}</p><p className="mt-1 text-[11px] text-[#8b877f]">{property ? 'Keep the record current for your operations team.' : 'Start with the details your team needs to find quickly.'}</p></div>
        <button data-testid="button-close-property-form" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full border border-[#e4e2de] text-[#817d76] hover:bg-[#f0eeea] hover:text-[#151412]"><X size={14} /></button>
      </div>
      <div className="max-h-[calc(92vh-72px)] overflow-y-auto px-5 py-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Property name"><input data-testid="input-property-name" className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Harbor View Residences" autoFocus /><FormError message={errors.name} /></Field></div>
           <Field label="Property type"><FlowPointSelect testId="select-property-type" value={form.property_type ?? ''} onChange={(value) => { set('property_type', value); if (value !== 'apartment_building') set('units_count', null); }} placeholder="Select a type" options={PROPERTY_TYPES.map((type) => ({ value: type.value, label: type.label }))} /></Field>
          <Field label="Status"><FlowPointSelect testId="select-property-status" value={form.status ?? ''} onChange={(value) => set('status', value)} placeholder="Select a status" options={PROPERTY_STATUSES.map((status) => ({ value: status.value, label: status.label }))} /></Field>
          <div className="sm:col-span-2"><Field label="Address line 1"><input data-testid="input-property-address" className={inputClass} value={form.address_line1 ?? ''} onChange={(e) => set('address_line1', e.target.value)} placeholder="Street address" /><FormError message={errors.address_line1} /></Field></div>
          <Field label="Address line 2" hint="optional"><input data-testid="input-property-address2" className={inputClass} value={form.address_line2 ?? ''} onChange={(e) => set('address_line2', e.target.value)} placeholder="Suite, floor, or building" /></Field>
          <Field label="Country"><input data-testid="input-property-country" className={inputClass} value={form.country ?? ''} onChange={(e) => set('country', e.target.value)} /><FormError message={errors.country} /></Field>
          <Field label="City"><input data-testid="input-property-city" className={inputClass} value={form.city ?? ''} onChange={(e) => set('city', e.target.value)} placeholder="City" /><FormError message={errors.city} /></Field>
          <Field label="State / region"><input data-testid="input-property-state" className={inputClass} value={form.state ?? ''} onChange={(e) => set('state', e.target.value)} placeholder="State" /></Field>
          <Field label="Postal code"><input data-testid="input-property-postal-code" className={inputClass} value={form.postal_code ?? ''} onChange={(e) => set('postal_code', e.target.value)} placeholder="Postal code" /></Field>
           {form.property_type === 'apartment_building' && <Field label="Apartment limit"><input data-testid="input-property-units" type="number" min="0" className={inputClass} value={form.units_count ?? ''} onChange={(e) => set('units_count', e.target.value === '' ? null : Number(e.target.value))} placeholder="e.g. 10" /><FormError message={errors.units_count} /></Field>}
          <div className="sm:col-span-2"><Field label="Description" hint="optional"><textarea data-testid="input-property-description" className={textAreaClass} rows={3} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder="A short description for your team" /></Field></div>
        </div>
         <div className="mt-5 border-t border-[#ebe8e3] pt-4">
           <div className="flex items-start justify-between gap-4">
             <div><p className="text-[12px] font-semibold text-[#35322e]">Ownership <span className="text-[#b33d32]">*</span></p><p className="mt-1 text-[11px] text-[#9c978e]">Every property must have at least one owner. Choose an existing contact or add the person as a new contact.</p></div>
             <Users size={16} className="mt-0.5 flex-shrink-0 text-[#aaa59d]" />
           </div>
           <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
             <Field label="Ownership structure">
               <FlowPointSelect
                 testId="select-property-ownership-structure"
                 value={ownershipStructure}
                 onChange={(value) => {
                   setOwnershipStructure(value as OwnershipStructure);
                   if (value === 'single') setOwners((current) => current.slice(0, 1));
                   if (value === 'multiple' && owners.length === 0) setOwners([blankOwnerDraft()]);
                 }}
                 placeholder="Choose ownership structure"
                 options={[{ value: 'single', label: 'Owned by one person' }, { value: 'multiple', label: 'Owned by multiple people' }]}
               />
             </Field>
             <Field label="How should ownership be recorded?">
               <FlowPointSelect
                 testId="select-property-ownership-basis"
                 value={ownershipBasis}
                 onChange={(value) => setOwnershipBasis(value as OwnershipBasis)}
                 placeholder="Choose ownership detail"
                 options={[{ value: 'percentage', label: 'Percentage owned' }, { value: 'scope', label: 'What they own inside the property' }]}
               />
             </Field>
           </div>
           <div className="mt-4 space-y-3">
             {owners.map((owner, index) => {
               const selectedContact = contacts.find((contact) => String(contact.id) === owner.contact_id);
               return <div key={owner.id ?? `owner-${index}`} className="rounded-[11px] border border-[#e9e6e1] bg-white p-3.5">
                 <div className="flex items-start justify-between gap-3">
                   <div><p className="text-[12px] font-semibold text-[#35322e]">{owners.length > 1 ? `Owner ${index + 1}` : 'Owner'}</p><p className="mt-1 text-[10px] text-[#9b968d]">{owner.source === 'existing' ? 'Linked to an existing contact' : 'This person will be added to Contacts'}</p></div>
                   {owners.length > 1 && <button type="button" onClick={() => setOwners((current) => current.filter((_, ownerIndex) => ownerIndex !== index))} className="flex h-7 w-7 items-center justify-center rounded-full border border-[#e4e2de] text-[#918b83] hover:bg-[#f5f3f0] hover:text-[#b33d32]" aria-label={`Remove owner ${index + 1}`}><Trash2 size={12} /></button>}
                 </div>
                 <div className="mt-3 flex gap-1 rounded-[8px] bg-[#f5f3f0] p-1">
                   <button type="button" onClick={() => updateOwner(index, { source: 'existing', contact_id: '', name: '', email: '', phone: '' })} className={`flex-1 rounded-[6px] px-2 py-1.5 text-[10px] font-semibold ${owner.source === 'existing' ? 'bg-white text-[#35322e] shadow-sm' : 'text-[#8f8981]'}`}>Choose existing contact</button>
                   <button type="button" onClick={() => updateOwner(index, { source: 'new', contact_id: '', name: '', email: '', phone: '' })} className={`flex-1 rounded-[6px] px-2 py-1.5 text-[10px] font-semibold ${owner.source === 'new' ? 'bg-white text-[#35322e] shadow-sm' : 'text-[#8f8981]'}`}>Add new contact</button>
                 </div>
                 <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                   {owner.source === 'existing' ? <Field label="Contact">
                     <FlowPointSelect
                       testId={`select-property-owner-${index}`}
                       value={owner.contact_id}
                       onChange={(value) => updateOwner(index, { contact_id: value, name: contacts.find((contact) => String(contact.id) === value)?.name ?? '' })}
                       placeholder="Select an owner contact"
                       options={contacts.map((contact) => ({ value: String(contact.id), label: contact.name, secondary: contact.customer_id ?? contact.email ?? contact.phone ?? undefined }))}
                       emptyLabel="No contacts found. Add a new contact instead."
                     />
                   </Field> : <div className="sm:col-span-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="Owner / company name"><input className={inputClass} value={owner.name} onChange={(event) => updateOwner(index, { name: event.target.value })} placeholder="Person or company name" /></Field>
                      <Field label="Entity type"><FlowPointSelect value={owner.contact_type ?? 'property_owner'} onChange={(value) => updateOwner(index, { contact_type: value as OwnerDraft['contact_type'] })} placeholder="Choose entity type" options={[{ value: 'property_owner', label: 'Person' }, { value: 'company', label: 'Company' }]} /></Field>
                     <Field label="Email or phone"><input className={inputClass} value={owner.email} onChange={(event) => updateOwner(index, { email: event.target.value })} placeholder="Email address" /></Field>
                     <Field label="Phone" hint="optional"><input className={inputClass} value={owner.phone} onChange={(event) => updateOwner(index, { phone: event.target.value })} placeholder="Phone number" /></Field>
                     <div className="flex items-end rounded-[9px] bg-[#faf9f7] px-3 py-2.5 text-[10px] leading-[1.4] text-[#8f8981]"><UserPlus size={13} className="mr-2 flex-shrink-0 text-[#aaa59d]" />Name plus an email or phone is required to create the contact.</div>
                   </div>}
                   {ownershipBasis === 'percentage' ? <Field label="Ownership percentage">
                     <div className="relative"><input type="number" min="0" max="100" step="0.01" className={inputClass} value={owner.ownership_percentage} onChange={(event) => updateOwner(index, { ownership_percentage: event.target.value })} placeholder="e.g. 50" /><span className="pointer-events-none absolute right-3 top-3 text-[12px] text-[#8f8981]">%</span></div>
                   </Field> : <Field label="What they own inside the property"><input className={inputClass} value={owner.ownership_scope} onChange={(event) => updateOwner(index, { ownership_scope: event.target.value })} placeholder="e.g. Units 1–4 and parking area" /></Field>}
                 </div>
                 <FormError message={errors[`owner_${index}`]} />
                 {owner.source === 'existing' && selectedContact && <p className="mt-2 text-[10px] text-[#8f8981]">Customer ID: <span className="font-semibold text-[#625e57]">{selectedContact.customer_id ?? 'Not assigned'}</span></p>}
               </div>;
             })}
           </div>
           {errors.owners && <FormError message={errors.owners} />}
           {ownershipStructure === 'multiple' && owners.length > 0 && owners.length < 20 && <button type="button" onClick={() => setOwners((current) => [...current, blankOwnerDraft()])} className="mt-3 flex h-8 items-center gap-1.5 rounded-[8px] border border-[#e4e2de] px-3 text-[11px] font-semibold text-[#625e57] hover:bg-[#f5f3f0]"><Plus size={12} />Add another owner</button>}
         </div>
        <button data-testid="button-toggle-property-details" onClick={() => setDetailsOpen((open) => !open)} className="mt-5 flex w-full items-center justify-between border-t border-[#ebe8e3] pt-4 text-left">
          <span><span className="block text-[12px] font-semibold text-[#35322e]">Operational details</span><span className="mt-1 block text-[11px] text-[#9c978e]">Access, parking, utilities, rules, and emergency notes</span></span>
          {detailsOpen ? <ChevronDown size={16} className="text-[#868178]" /> : <ChevronRight size={16} className="text-[#868178]" />}
        </button>
        {detailsOpen && <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Amenities" hint="optional"><textarea data-testid="input-property-amenities" className={textAreaClass} rows={3} value={form.amenities ?? ''} onChange={(e) => set('amenities', e.target.value)} placeholder="Pool, gym, laundry..." /></Field>
          <Field label="Property rules" hint="optional"><textarea data-testid="input-property-rules" className={textAreaClass} rows={3} value={form.property_rules ?? ''} onChange={(e) => set('property_rules', e.target.value)} placeholder="Guidelines for residents and visitors" /></Field>
          <Field label="Parking information" hint="optional"><textarea data-testid="input-property-parking" className={textAreaClass} rows={3} value={form.parking_information ?? ''} onChange={(e) => set('parking_information', e.target.value)} placeholder="Parking spaces, permits, or restrictions" /></Field>
          <Field label="Access information" hint="optional"><textarea data-testid="input-property-access" className={textAreaClass} rows={3} value={form.access_information ?? ''} onChange={(e) => set('access_information', e.target.value)} placeholder="Entry instructions or access systems" /></Field>
          <Field label="Utilities information" hint="optional"><textarea data-testid="input-property-utilities" className={textAreaClass} rows={3} value={form.utilities_information ?? ''} onChange={(e) => set('utilities_information', e.target.value)} placeholder="Providers, billing, or included utilities" /></Field>
          <Field label="Emergency information" hint="optional"><textarea data-testid="input-property-emergency" className={textAreaClass} rows={3} value={form.emergency_information ?? ''} onChange={(e) => set('emergency_information', e.target.value)} placeholder="Emergency contacts or procedures" /></Field>
          <div className="sm:col-span-2"><Field label="Internal notes" hint="optional"><textarea data-testid="input-property-notes" className={textAreaClass} rows={3} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder="Private notes for your operations team" /></Field></div>
        </div>}
        {saveError && <div className="mt-4 flex items-start gap-2 rounded-[9px] border border-[#f0c8c3] bg-[#fff7f6] px-3 py-2.5 text-[12px] text-[#a33a30]"><AlertCircle size={14} className="mt-0.5 flex-shrink-0" />{saveError}</div>}
        <div className="mt-5 flex justify-end gap-2 border-t border-[#ebe8e3] pt-4">
          <button data-testid="button-cancel-property" onClick={onClose} disabled={saving} className="h-9 rounded-[9px] border border-[#e4e2de] px-4 text-[12px] font-medium text-[#625e57] hover:bg-[#f0eeea] disabled:opacity-50">Cancel</button>
          <button data-testid="button-save-property" onClick={submit} disabled={saving} className="flex h-9 items-center gap-2 rounded-[9px] bg-[#151412] px-4 text-[12px] font-semibold text-white hover:bg-[#312f2c] disabled:opacity-50">{saving && <Loader2 size={13} className="animate-spin" />}{property ? 'Save changes' : 'Add property'}</button>
        </div>
      </div>
    </Modal>
  );
}

function StatusPill({ status }: { status: string | null }) {
  const tone = status === 'active' ? 'bg-[#edf7ef] text-[#327443] border-[#d6ecd9]' : status === 'inactive' ? 'bg-[#fff7e6] text-[#a36810] border-[#f1dfb8]' : 'bg-[#f1f0ee] text-[#77736d] border-[#e1dfda]';
  return <span data-testid={`status-property-${status ?? 'unknown'}`} className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tone}`}>{propertyStatusLabel(status)}</span>;
}

function PropertyCard({
  property,
  units,
  contacts,
  relationships,
  onOpen,
  onUnitSave,
  onUnitDelete,
}: {
  property: Property;
  units: Unit[];
  contacts: Contact[];
  relationships: ContactPropertyRelationship[];
  onOpen: () => void;
  onUnitSave: (payload: UnitSavePayload, existingUnit: Unit | null) => Promise<void>;
  onUnitDelete: (unit: Unit) => Promise<void>;
}) {
  const propertyUnits = units.filter((unit) => unit.property_id === property.id);
  const occupied = propertyUnits.filter((unit) => unit.status === 'occupied').length;
  return <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} data-testid={`card-property-${property.id}`} className="rounded-[13px] border border-[#e9e6e1] bg-white p-4 text-left transition-all hover:border-[#d2cec7] hover:shadow-[0_6px_22px_rgba(31,28,23,.06)]">
    <div className="flex items-start justify-between gap-3">
      <button onClick={onOpen} className="group flex min-w-0 flex-1 items-start gap-3 text-left">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-[#f1eee9] text-[#706b62]"><Building2 size={17} strokeWidth={1.7} /></div>
        <div className="min-w-0"><p data-testid={`text-property-name-${property.id}`} className="truncate text-[13px] font-semibold text-[#171512]">{property.name}</p><p className="mt-1 flex items-center gap-1 truncate text-[11px] text-[#97928a]"><MapPin size={11} />{propertyAddress(property) || 'Address unavailable'}</p></div>
        <ChevronRight size={15} className="mt-1 flex-shrink-0 text-[#bbb6ae] transition-transform group-hover:translate-x-0.5" />
      </button>
      <button onClick={onOpen} className="rounded-[8px] border border-[#e4e2de] px-2 py-1 text-[10px] font-semibold text-[#625e57] hover:bg-[#f5f3f0]">Manage</button>
    </div>
    <div className="mt-4 border-t border-[#f0eeeb] pt-3">
      <div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-[11px] text-[#77736d]">{propertyTypeLabel(property.property_type)}</span><span className="h-1 w-1 rounded-full bg-[#d2cec7]" /><span className="text-[11px] text-[#77736d]">{property.units_count === null ? 'Single record' : `${propertyUnits.length}/${property.units_count} units`}</span></div><StatusPill status={property.status} /></div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]"><div><p className="text-[#aaa59d]">Rented</p><p className="mt-0.5 font-semibold text-[#625e57]">{occupied}</p></div><div><p className="text-[#aaa59d]">Not rented</p><p className="mt-0.5 font-semibold text-[#625e57]">{propertyUnits.filter((unit) => unit.status === 'vacant').length}</p></div><div><p className="text-[#aaa59d]">Owners</p><p className="mt-0.5 font-semibold text-[#625e57]">{relationships.filter((item) => item.property_id === property.id && item.relationship_type === 'owner' && !item.unit_id).length}</p></div></div>
      <PropertyUnitManager property={property} units={units} contacts={contacts} relationships={relationships} onSave={onUnitSave} onDelete={onUnitDelete} />
    </div>
  </motion.div>;
}

export default function PropertiesPage() {
  useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [ownerships, setOwnerships] = useState<ContactPropertyRelationship[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const loadProperties = useCallback(async () => {
    setLoading(true); setError(null);
    const [propertiesResult, contactsResult, ownershipsResult, unitsResult] = await Promise.all([
      supabase.from('properties').select('*').order('name', { ascending: true }),
      supabase.from('contacts').select('*').order('name', { ascending: true }),
      supabase.from('contact_property_relationships').select('id, company_id, contact_id, property_id, unit_id, relationship_type, start_date, end_date, notes, ownership_percentage, ownership_scope'),
      supabase.from('units').select('*').order('unit_number', { ascending: true }),
    ]);
    const { data, error: loadError } = propertiesResult;
    if (loadError) setError(loadError.message);
    else setProperties((data as Property[]) ?? []);
    if (!contactsResult.error) setContacts((contactsResult.data as Contact[]) ?? []);
    if (!ownershipsResult.error) setOwnerships((ownershipsResult.data as ContactPropertyRelationship[]) ?? []);
    if (!unitsResult.error) setUnits((unitsResult.data as Unit[]) ?? []);
    if (unitsResult.error && !loadError) setError(unitsResult.error.message);
    setLoading(false);
  }, []);
  useEffect(() => { loadProperties(); }, [loadProperties]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return properties.filter((property) => {
      const matchesSearch = !needle || [property.name, property.address_line1, property.address_line2, property.city, property.state, property.postal_code].filter(Boolean).join(' ').toLowerCase().includes(needle);
      return matchesSearch && (!typeFilter || property.property_type === typeFilter) && (!statusFilter || property.status === statusFilter);
    });
  }, [properties, search, typeFilter, statusFilter]);

  const syncPropertyOwners = async (propertyId: string, ownerDrafts: OwnerDraft[]) => {
    const resolvedContacts: Contact[] = [...contacts];
    const rows: Array<Record<string, unknown>> = [];
    for (const owner of ownerDrafts) {
      let contact: Contact | undefined = owner.source === 'existing'
        ? resolvedContacts.find((item) => String(item.id) === owner.contact_id)
        : undefined;
      if (!contact && owner.source === 'new') {
        const normalizedName = owner.name.trim().toLowerCase();
        const normalizedEmail = owner.email.trim().toLowerCase();
        const normalizedPhone = owner.phone.replace(/\D/g, '');
        const sameName = resolvedContacts.filter((item) => item.name.trim().toLowerCase() === normalizedName);
        contact = sameName.find((item) => (
          (normalizedEmail && item.email?.trim().toLowerCase() === normalizedEmail)
          || (normalizedPhone && item.phone?.replace(/\D/g, '') === normalizedPhone)
        )) ?? (sameName.length === 1 ? sameName[0] : undefined);
      if (!contact) {
          const { data: created, error: contactError } = await supabase.from('contacts').insert([{
            name: owner.name.trim(),
            email: owner.email.trim() || null,
            phone: owner.phone.trim() || null,
            contact_type: owner.contact_type ?? 'property_owner',
            status: 'active',
            preferred_channel: owner.email.trim() ? 'email' : 'phone',
          }]).select().single();
          if (contactError) throw new Error(`Unable to add owner contact: ${contactError.message}`);
          contact = created as Contact;
          resolvedContacts.push(contact);
        }
      }
      if (!contact) throw new Error('Select an existing owner contact or provide valid new contact details.');
      rows.push({
        contact_id: contact.id,
        property_id: propertyId,
        unit_id: null,
        relationship_type: 'owner',
        start_date: null,
        end_date: null,
        notes: null,
        ownership_percentage: owner.ownership_percentage ? Number(owner.ownership_percentage) : null,
        ownership_scope: owner.ownership_scope || null,
      });
    }
    const { error: deleteError } = await supabase.from('contact_property_relationships').delete().eq('property_id', propertyId).eq('relationship_type', 'owner').is('unit_id', null);
    if (deleteError) throw new Error(`Unable to replace property owners: ${deleteError.message}`);
    const { data: inserted, error: insertError } = await supabase.from('contact_property_relationships').insert(rows).select('id, company_id, contact_id, property_id, unit_id, relationship_type, start_date, end_date, notes, ownership_percentage, ownership_scope');
    if (insertError) throw new Error(`Unable to save property owners: ${insertError.message}`);
    setContacts(resolvedContacts);
    setOwnerships((current) => [...current.filter((item) => !(item.property_id === propertyId && item.relationship_type === 'owner' && !item.unit_id)), ...((inserted as ContactPropertyRelationship[]) ?? [])]);
  };

  const saveProperty = async (draft: PropertyDraft, ownerDrafts: OwnerDraft[]) => {
    const { data, error: saveError } = await supabase.from('properties').insert([draft]).select().single();
    if (saveError) throw new Error(saveError.message);
    const inserted = data as Property;
    try {
      await syncPropertyOwners(inserted.id, ownerDrafts);
    } catch (ownerError) {
      await supabase.from('properties').delete().eq('id', inserted.id);
      throw ownerError;
    }
    setProperties((current) => [...current, inserted].sort((a, b) => a.name.localeCompare(b.name)));
    setFeedback({ tone: 'success', message: 'Property and ownership added.' });
  };

  const updateProperty = async (draft: PropertyDraft, ownerDrafts: OwnerDraft[]) => {
    if (!selectedProperty) return;
    const { data, error: updateError } = await supabase.from('properties').update(draft).eq('id', selectedProperty.id).select().single();
    if (updateError) throw new Error(updateError.message);
    const updated = data as Property;
    await syncPropertyOwners(updated.id, ownerDrafts);
    setProperties((current) => current.map((property) => property.id === updated.id ? updated : property).sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedProperty(updated);
    setFeedback({ tone: 'success', message: 'Property and ownership changes saved.' });
  };

  const saveUnit = async (payload: UnitSavePayload, existingUnit: Unit | null) => {
    const { draft, owner, renter } = payload;
    const unitResult = existingUnit
      ? await supabase.from('units').update(draft).eq('id', existingUnit.id).select().single()
      : await supabase.from('units').insert([draft]).select().single();
    if (unitResult.error) throw new Error(unitResult.error.message);
    const savedUnit = unitResult.data as Unit;
    const resolvedContacts = [...contacts];
    const resolveContact = async (selection: NonNullable<UnitSavePayload['owner']>, fallbackType: 'property_owner' | 'company' | 'tenant') => {
      if (selection.mode === 'existing') {
        const found = resolvedContacts.find((contact) => String(contact.id) === selection.contact_id);
        if (!found) throw new Error('The selected contact is no longer available.');
        return found;
      }
      const normalizedName = selection.name.trim().toLowerCase();
      const normalizedEmail = selection.email.trim().toLowerCase();
      const normalizedPhone = selection.phone.replace(/\D/g, '');
      const sameName = resolvedContacts.filter((contact) => contact.name.trim().toLowerCase() === normalizedName);
      const existing = sameName.find((contact) => (normalizedEmail && contact.email?.trim().toLowerCase() === normalizedEmail) || (normalizedPhone && contact.phone?.replace(/\D/g, '') === normalizedPhone)) ?? (sameName.length === 1 ? sameName[0] : undefined);
      if (existing) return existing;
      const { data, error: contactError } = await supabase.from('contacts').insert([{
        name: selection.name.trim(),
        email: selection.email.trim() || null,
        phone: selection.phone.trim() || null,
        contact_type: selection.contact_type ?? fallbackType,
        status: 'active',
        preferred_channel: selection.email.trim() ? 'email' : 'phone',
      }]).select().single();
      if (contactError) throw new Error(`Unable to add contact: ${contactError.message}`);
      const created = data as Contact;
      resolvedContacts.push(created);
      return created;
    };

    try {
      const ownerContact = owner ? await resolveContact(owner, 'property_owner') : null;
      const renterContact = renter ? await resolveContact(renter, 'tenant') : null;
      const { error: relationshipDeleteError } = await supabase.from('contact_property_relationships').delete().eq('unit_id', savedUnit.id);
      if (relationshipDeleteError) throw new Error(`Unable to replace unit contacts: ${relationshipDeleteError.message}`);
      const relationRows = [
        ownerContact && {
          contact_id: ownerContact.id,
          property_id: savedUnit.property_id,
          unit_id: savedUnit.id,
          relationship_type: 'owner',
          start_date: null,
          end_date: null,
          notes: null,
          ownership_percentage: null,
          ownership_scope: null,
        },
        renterContact && {
          contact_id: renterContact.id,
          property_id: savedUnit.property_id,
          unit_id: savedUnit.id,
          relationship_type: 'tenant',
          start_date: savedUnit.lease_start_date,
          end_date: savedUnit.lease_end_date,
          notes: null,
          ownership_percentage: null,
          ownership_scope: null,
        },
      ].filter(Boolean) as Array<Record<string, unknown>>;
      const { data: insertedRelationships, error: relationshipInsertError } = relationRows.length
        ? await supabase.from('contact_property_relationships').insert(relationRows).select('id, company_id, contact_id, property_id, unit_id, relationship_type, start_date, end_date, notes, ownership_percentage, ownership_scope')
        : { data: [], error: null };
      if (relationshipInsertError) throw new Error(`Unable to save unit contacts: ${relationshipInsertError.message}`);
      setContacts(resolvedContacts);
      setUnits((current) => {
        const next = existingUnit ? current.map((unit) => unit.id === savedUnit.id ? savedUnit : unit) : [...current, savedUnit];
        return next.sort((a, b) => a.unit_number.localeCompare(b.unit_number, undefined, { numeric: true }));
      });
      setOwnerships((current) => [...current.filter((item) => item.unit_id !== savedUnit.id), ...((insertedRelationships as ContactPropertyRelationship[]) ?? [])]);
      setFeedback({ tone: 'success', message: existingUnit ? 'Unit changes saved.' : 'Unit added.' });
    } catch (error) {
      if (!existingUnit) await supabase.from('units').delete().eq('id', savedUnit.id);
      throw error;
    }
  };

  const deleteUnit = async (unit: Unit) => {
    const { error: deleteError } = await supabase.from('units').delete().eq('id', unit.id);
    if (deleteError) {
      setFeedback({ tone: 'error', message: deleteError.message });
      return;
    }
    setUnits((current) => current.filter((item) => item.id !== unit.id));
    setOwnerships((current) => current.filter((item) => item.unit_id !== unit.id));
    setFeedback({ tone: 'success', message: 'Unit deleted.' });
  };

  const deleteProperty = async () => {
    if (!selectedProperty) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('properties').delete().eq('id', selectedProperty.id);
    if (deleteError) {
      setFeedback({ tone: 'error', message: deleteError.message });
      setDeleting(false);
      setDeleteOpen(false);
      return;
    }
    setProperties((current) => current.filter((property) => property.id !== selectedProperty.id));
    setSelectedProperty(null);
    setDeleteOpen(false);
    setDeleting(false);
    setFeedback({ tone: 'success', message: 'Property deleted.' });
  };

  return <AppLayout><div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8f7f5]">
    <header className="flex flex-shrink-0 items-center justify-between border-b border-[#e9e6e1] bg-[#fbfaf8] px-5 py-4 sm:px-8"><div><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#a19c93]">Operations</p><h1 data-testid="heading-properties" className="mt-1 text-[20px] font-semibold tracking-[-.02em] text-[#151412]">Properties</h1></div><button data-testid="button-add-property" onClick={() => setFormOpen(true)} className="flex h-9 items-center gap-2 rounded-[9px] bg-[#151412] px-3.5 text-[12px] font-semibold text-white shadow-[0_2px_5px_rgba(0,0,0,.12)] hover:bg-[#312f2c]"><Plus size={14} />Add property</button></header>
    <div className="min-h-0 flex-1 overflow-y-auto"><div className="mx-auto max-w-[1240px] px-5 py-6 sm:px-8 sm:py-8">
      {feedback && <div data-testid={`feedback-properties-${feedback.tone}`} className={`mb-5 flex items-center justify-between rounded-[10px] border px-3 py-2.5 text-[12px] ${feedback.tone === 'success' ? 'border-[#d2ead7] bg-[#f2faf3] text-[#327443]' : 'border-[#f0c8c3] bg-[#fff7f6] text-[#a33a30]'}`}><span className="flex items-center gap-2">{feedback.tone === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}{feedback.message}</span><button data-testid="button-dismiss-properties-feedback" onClick={() => setFeedback(null)}><X size={14} /></button></div>}
      <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><p className="text-[13px] text-[#706c64]">A clear home for every place your team looks after.</p><p className="mt-1 text-[11px] text-[#a19c93]">{properties.length} {properties.length === 1 ? 'property' : 'properties'} in your portfolio</p></div><div className="flex flex-col gap-2 sm:flex-row"><label className="relative block min-w-[230px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a8a39b]" /><input data-testid="input-property-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or address" className={`${inputClass} pl-9`} /></label><div className="flex gap-2"><div className="min-w-[128px]"><FlowPointSelect testId="select-property-type-filter" value={typeFilter} onChange={setTypeFilter} placeholder="All types" options={PROPERTY_TYPES.map((type) => ({ value: type.value, label: type.label }))} /></div><div className="min-w-[128px]"><FlowPointSelect testId="select-property-status-filter" value={statusFilter} onChange={setStatusFilter} placeholder="All statuses" options={PROPERTY_STATUSES.map((status) => ({ value: status.value, label: status.label }))} /></div></div></div></div>
      {loading && <div data-testid="loading-properties" className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="h-[132px] animate-pulse rounded-[13px] border border-[#eeeae5] bg-[#f0eeeb]" />)}</div>}
      {!loading && error && <div data-testid="error-properties" className="flex flex-col items-center justify-center rounded-[14px] border border-[#f0c8c3] bg-[#fff9f8] px-6 py-16 text-center"><AlertCircle size={24} className="text-[#b33d32]" /><p className="mt-3 text-[13px] font-semibold text-[#4d2c28]">Properties could not be loaded</p><p className="mt-1 max-w-[380px] text-[12px] text-[#9d716b]">{error}</p><button data-testid="button-retry-properties" onClick={loadProperties} className="mt-4 flex h-8 items-center gap-2 rounded-[8px] border border-[#e6c2bd] px-3 text-[12px] font-medium text-[#8e3a31] hover:bg-[#fff0ee]"><RefreshCw size={12} />Try again</button></div>}
      {!loading && !error && properties.length === 0 && <div data-testid="empty-properties" className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-[#d9d5ce] bg-[#fbfaf8] px-6 py-20 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#f0ede8] text-[#777269]"><Building2 size={23} strokeWidth={1.5} /></div><p className="mt-4 text-[14px] font-semibold text-[#34312c]">No properties yet</p><p className="mt-1 max-w-[360px] text-[12px] leading-[1.6] text-[#97928a]">Add the first property to give your operations team a shared source of truth.</p><button data-testid="button-empty-add-property" onClick={() => setFormOpen(true)} className="mt-5 flex h-9 items-center gap-2 rounded-[9px] bg-[#151412] px-3.5 text-[12px] font-semibold text-white hover:bg-[#312f2c]"><Plus size={14} />Add property</button></div>}
      {!loading && !error && properties.length > 0 && filtered.length === 0 && <div data-testid="empty-filtered-properties" className="rounded-[14px] border border-[#e9e6e1] bg-white px-6 py-16 text-center"><Filter size={20} className="mx-auto text-[#bbb6ae]" /><p className="mt-3 text-[13px] font-semibold text-[#4a4741]">No matching properties</p><p className="mt-1 text-[12px] text-[#99948b]">Try a different search or clear one of the filters.</p><button data-testid="button-clear-property-filters" onClick={() => { setSearch(''); setTypeFilter(''); setStatusFilter(''); }} className="mt-4 text-[12px] font-semibold text-[#4a4741] underline underline-offset-2">Clear filters</button></div>}
       {!loading && !error && filtered.length > 0 && <div data-testid="list-properties" className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"><AnimatePresence mode="popLayout">{filtered.map((property) => <PropertyCard key={property.id} property={property} units={units} contacts={contacts} relationships={ownerships} onOpen={() => setSelectedProperty(property)} onUnitSave={saveUnit} onUnitDelete={deleteUnit} />)}</AnimatePresence></div>}
    </div></div>
    <AnimatePresence>{formOpen && <PropertyForm property={null} contacts={contacts} ownerships={ownerships} onSave={async (draft, owners) => { await saveProperty(draft, owners); }} onClose={() => setFormOpen(false)} />}</AnimatePresence>
    {selectedProperty && !editOpen && !deleteOpen && <PropertyProfileModal property={selectedProperty} contacts={contacts} ownerships={ownerships} onClose={() => setSelectedProperty(null)} onEdit={() => setEditOpen(true)} onDelete={() => setDeleteOpen(true)} />}
    <AnimatePresence>{editOpen && selectedProperty && <PropertyForm property={selectedProperty} contacts={contacts} ownerships={ownerships} onSave={async (draft, owners) => { await updateProperty(draft, owners); setEditOpen(false); }} onClose={() => setEditOpen(false)} />}</AnimatePresence>
    <AnimatePresence>{deleteOpen && selectedProperty && <ConfirmDelete name={selectedProperty.name} deleting={deleting} onCancel={() => setDeleteOpen(false)} onConfirm={deleteProperty} />}</AnimatePresence>
  </div></AppLayout>;
}