import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  BriefcaseBusiness,
  Building2,
  Check,
  ChevronRight,
  Clock3,
  Filter,
  Home,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
  Users2,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import FlowPointSelect from '@/components/FlowPointSelect';
import NotificationBell from '@/components/NotificationBell';
import { supabase } from '@/lib/supabase';
import type { Contact, Staff } from '@/lib/contactsTypes';
import type { Property } from '@/lib/propertiesTypes';
import type { Unit } from '@/lib/unitsTypes';
import {
  SERVICE_STATUSES,
  serviceStatusLabel,
  type Service,
  type ServiceContactRelationship,
  type ServiceDraft,
  type ServicePropertyRelationship,
  type ServiceStaffRelationship,
  type ServiceUnitRelationship,
} from '@/lib/servicesTypes';
import { ageLabel, requestPriorityLabel, requestStatusLabel, type RequestRecord } from '@/lib/requestsTypes';

const inputClass =
  'w-full h-[39px] rounded-[9px] border border-[#e4e2de] bg-white px-[11px] text-[13px] text-[#151412] outline-none placeholder:text-[#b3b0aa] focus:border-[#151412] focus:ring-2 focus:ring-[#151412]/8 transition-all';
const textAreaClass =
  'w-full rounded-[9px] border border-[#e4e2de] bg-white px-[11px] py-[9px] text-[13px] leading-[1.5] text-[#151412] outline-none placeholder:text-[#b3b0aa] focus:border-[#151412] focus:ring-2 focus:ring-[#151412]/8 transition-all resize-none';

type RelationshipState = {
  contacts: ServiceContactRelationship[];
  staff: ServiceStaffRelationship[];
  properties: ServicePropertyRelationship[];
  units: ServiceUnitRelationship[];
};

function Modal({
  children,
  onClose,
  wide = false,
  extraWide = false,
}: {
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  extraWide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#171511]/30 backdrop-blur-[2px]"
      />
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        className={`relative max-h-[92vh] w-full overflow-hidden rounded-[16px] border border-[#e4e2de] bg-[#fbfaf8] shadow-[0_24px_80px_rgba(25,22,18,.18)] ${
          extraWide ? 'max-w-[980px]' : wide ? 'max-w-[780px]' : 'max-w-[540px]'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </motion.div>
    </div>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-[5px] block text-[10px] font-semibold uppercase tracking-[.08em] text-[#77736d]">
        {label}
        {hint && <span className="ml-1 normal-case font-normal tracking-normal text-[#aaa59d]">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-[9px] border border-[#f0c8c3] bg-[#fff7f6] px-3 py-2.5 text-[11px] text-[#a33a30]">
      <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
      {message}
    </div>
  );
}

function StatusPill({ status }: { status: string | null | undefined }) {
  const style =
    status === 'active'
      ? 'border-[#d2ead7] bg-[#f2faf3] text-[#327443]'
      : 'border-[#f1dfb8] bg-[#fff7e6] text-[#a36810]';
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${style}`}>
      {serviceStatusLabel(status)}
    </span>
  );
}

function EmptyState({
  icon: Icon = BriefcaseBusiness,
  title,
  description,
}: {
  icon?: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-[#d9d5ce] bg-[#fbfaf8] px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#f0ede8] text-[#777269]">
        <Icon size={23} strokeWidth={1.5} />
      </div>
      <p className="mt-4 text-[14px] font-semibold text-[#34312c]">{title}</p>
      <p className="mt-1 max-w-[380px] text-[12px] leading-[1.6] text-[#97928a]">{description}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#f0eeeb] py-2 last:border-0">
      <span className="text-[10px] font-semibold uppercase tracking-[.06em] text-[#aaa59d]">{label}</span>
      <span className="max-w-[68%] whitespace-pre-wrap text-right text-[12px] text-[#4d4942]">
        {value || 'Not provided'}
      </span>
    </div>
  );
}

function SelectionChips({
  labels,
  onRemove,
}: {
  labels: { id: string; label: string; secondary?: string }[];
  onRemove: (id: string) => void;
}) {
  if (!labels.length) return <p className="mt-2 text-[11px] italic text-[#aaa59d]">None selected yet.</p>;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {labels.map((item) => (
        <span
          key={item.id}
          className="flex items-center gap-1 rounded-full border border-[#e9e6e1] bg-[#faf9f7] px-2 py-1 text-[10px] text-[#5f5a52]"
        >
          {item.label}
          {item.secondary && <span className="text-[#aaa59d]">· {item.secondary}</span>}
          <button type="button" onClick={() => onRemove(item.id)} className="ml-0.5 text-[#aaa59d] hover:text-[#a33a30]">
            <X size={11} />
          </button>
        </span>
      ))}
    </div>
  );
}

function ServiceForm({
  service,
  relationships,
  contacts,
  staff,
  properties,
  units,
  onSave,
  onClose,
}: {
  service: Service | null;
  relationships: RelationshipState;
  contacts: Contact[];
  staff: Staff[];
  properties: Property[];
  units: Unit[];
  onSave: (draft: ServiceDraft, selected: { contactIds: string[]; staffIds: string[]; propertyIds: string[]; unitIds: string[] }) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ServiceDraft>(() => ({
    name: service?.name ?? '',
    category: service?.category ?? '',
    short_description: service?.short_description ?? '',
    description: service?.description ?? '',
    customer_facing_description: service?.customer_facing_description ?? '',
    requirements: service?.requirements ?? '',
    included_details: service?.included_details ?? '',
    excluded_details: service?.excluded_details ?? '',
    pricing_information: service?.pricing_information ?? '',
    availability_information: service?.availability_information ?? '',
    typical_response_time: service?.typical_response_time ?? '',
    internal_instructions: service?.internal_instructions ?? '',
    escalation_instructions: service?.escalation_instructions ?? '',
    status: service?.status ?? 'active',
  }));
  const [contactIds, setContactIds] = useState<string[]>(() => relationships.contacts.filter((item) => item.service_id === service?.id).map((item) => String(item.contact_id)));
  const [staffIds, setStaffIds] = useState<string[]>(() => relationships.staff.filter((item) => item.service_id === service?.id).map((item) => String(item.staff_id)));
  const [propertyIds, setPropertyIds] = useState<string[]>(() => relationships.properties.filter((item) => item.service_id === service?.id).map((item) => item.property_id));
  const [unitIds, setUnitIds] = useState<string[]>(() => relationships.units.filter((item) => item.service_id === service?.id).map((item) => item.unit_id));
  const [contactToAdd, setContactToAdd] = useState('');
  const [staffToAdd, setStaffToAdd] = useState('');
  const [propertyToAdd, setPropertyToAdd] = useState('');
  const [unitToAdd, setUnitToAdd] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(Boolean(service));
  const [customerOpen, setCustomerOpen] = useState(Boolean(service));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof ServiceDraft>(key: K, value: ServiceDraft[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    if (!form.name.trim()) {
      setError('Service name is required');
      return;
    }
    if (!form.category.trim()) {
      setError('Category is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(
        {
          ...form,
          name: form.name.trim(),
          category: form.category.trim(),
          short_description: form.short_description?.trim() || null,
          description: form.description?.trim() || null,
          customer_facing_description: form.customer_facing_description?.trim() || null,
          requirements: form.requirements?.trim() || null,
          included_details: form.included_details?.trim() || null,
          excluded_details: form.excluded_details?.trim() || null,
          pricing_information: form.pricing_information?.trim() || null,
          availability_information: form.availability_information?.trim() || null,
          typical_response_time: form.typical_response_time?.trim() || null,
          internal_instructions: form.internal_instructions?.trim() || null,
          escalation_instructions: form.escalation_instructions?.trim() || null,
        },
        { contactIds, staffIds, propertyIds, unitIds },
      );
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save service');
      setSaving(false);
    }
  };

  const contactOptions = contacts.filter((item) => !contactIds.includes(String(item.id)));
  const staffOptions = staff.filter((item) => !staffIds.includes(String(item.id)));
  const propertyOptions = properties.filter((item) => !propertyIds.includes(item.id));
  const unitOptions = units.filter((item) => !unitIds.includes(item.id));

  return (
    <Modal onClose={onClose} wide>
      <div className="flex items-center justify-between border-b border-[#ebe8e3] px-5 py-4">
        <div>
          <p className="text-[15px] font-semibold text-[#151412]">{service ? 'Edit service' : 'Add service'}</p>
          <p className="mt-1 text-[11px] text-[#8b877f]">Document what the company provides so the team and future assistant have one reliable source of truth.</p>
        </div>
        <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full border border-[#e4e2de] text-[#817d76] hover:bg-[#f0eeea]">
          <X size={14} />
        </button>
      </div>
      <div className="max-h-[calc(92vh-72px)] overflow-y-auto px-5 py-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="mb-3 border-b border-[#ebe8e3] pb-2 text-[12px] font-semibold text-[#35322e]">Basic information</p>
          </div>
          <div className="sm:col-span-2">
            <Field label="Service name">
              <input autoFocus className={inputClass} value={form.name} onChange={(event) => set('name', event.target.value)} placeholder="Resident onboarding" />
            </Field>
          </div>
          <Field label="Category">
            <input className={inputClass} value={form.category} onChange={(event) => set('category', event.target.value)} placeholder="Resident support" />
          </Field>
          <Field label="Status">
            <FlowPointSelect value={form.status} onChange={(value) => set('status', value as ServiceDraft['status'])} placeholder="Select status" options={SERVICE_STATUSES.map((item) => ({ ...item }))} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Short description">
              <input className={inputClass} value={form.short_description ?? ''} onChange={(event) => set('short_description', event.target.value)} placeholder="A concise description for the service list" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Detailed description">
              <textarea className={textAreaClass} rows={3} value={form.description ?? ''} onChange={(event) => set('description', event.target.value)} placeholder="What this service is, who it is for, and when the team provides it." />
            </Field>
          </div>
        </div>

        <button onClick={() => setDetailsOpen((open) => !open)} className="mt-5 flex w-full items-center justify-between border-t border-[#ebe8e3] pt-4 text-left">
          <span>
            <span className="block text-[12px] font-semibold text-[#35322e]">Operations</span>
            <span className="mt-1 block text-[11px] text-[#9c978e]">Ownership, scope, eligibility, response expectations, and internal guidance</span>
          </span>
          {detailsOpen ? <ChevronRight size={16} className="rotate-90 text-[#868178]" /> : <ChevronRight size={16} className="text-[#868178]" />}
        </button>
        {detailsOpen && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Availability / eligibility" hint="optional">
              <textarea className={textAreaClass} rows={3} value={form.availability_information ?? ''} onChange={(event) => set('availability_information', event.target.value)} placeholder="Who can request this service and when it is available" />
            </Field>
            <Field label="Typical response time" hint="optional">
              <input className={inputClass} value={form.typical_response_time ?? ''} onChange={(event) => set('typical_response_time', event.target.value)} placeholder="Within 1 business day" />
            </Field>
            <Field label="Internal instructions" hint="optional">
              <textarea className={textAreaClass} rows={4} value={form.internal_instructions ?? ''} onChange={(event) => set('internal_instructions', event.target.value)} placeholder="Steps the team should follow internally" />
            </Field>
            <Field label="Escalation instructions" hint="optional">
              <textarea className={textAreaClass} rows={4} value={form.escalation_instructions ?? ''} onChange={(event) => set('escalation_instructions', event.target.value)} placeholder="When and how to escalate this service" />
            </Field>
            <div className="sm:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#77736d]">Assigned staff / team</p>
              <div className="mt-2 flex gap-2">
                <div className="min-w-0 flex-1"><FlowPointSelect value={staffToAdd} onChange={setStaffToAdd} placeholder="Select a staff member" options={staffOptions.map((item) => ({ value: String(item.id), label: item.name, secondary: [item.role, item.department].filter(Boolean).join(' · ') }))} emptyLabel="No unassigned staff" /></div>
                <button type="button" onClick={() => { if (staffToAdd) { setStaffIds((current) => [...current, staffToAdd]); setStaffToAdd(''); } }} disabled={!staffToAdd} className="flex h-[39px] items-center gap-1 rounded-[9px] border border-[#e4e2de] px-3 text-[11px] font-semibold text-[#625e57] hover:bg-[#f4f2ef] disabled:opacity-40"><Plus size={12} />Add</button>
              </div>
              <SelectionChips labels={staffIds.map((id) => { const item = staff.find((candidate) => String(candidate.id) === id); return { id, label: item?.name ?? 'Staff unavailable', secondary: item?.role ?? undefined }; })} onRemove={(id) => setStaffIds((current) => current.filter((item) => item !== id))} />
            </div>
            <div className="sm:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#77736d]">Properties the service applies to</p>
              <div className="mt-2 flex gap-2">
                <div className="min-w-0 flex-1"><FlowPointSelect value={propertyToAdd} onChange={setPropertyToAdd} placeholder="Select a property" options={propertyOptions.map((item) => ({ value: item.id, label: item.name, secondary: [item.city, item.address_line1].filter(Boolean).join(' · ') }))} emptyLabel="No unassigned properties" /></div>
                <button type="button" onClick={() => { if (propertyToAdd) { setPropertyIds((current) => [...current, propertyToAdd]); setPropertyToAdd(''); } }} disabled={!propertyToAdd} className="flex h-[39px] items-center gap-1 rounded-[9px] border border-[#e4e2de] px-3 text-[11px] font-semibold text-[#625e57] hover:bg-[#f4f2ef] disabled:opacity-40"><Plus size={12} />Add</button>
              </div>
              <SelectionChips labels={propertyIds.map((id) => { const item = properties.find((candidate) => candidate.id === id); return { id, label: item?.name ?? 'Property unavailable' }; })} onRemove={(id) => setPropertyIds((current) => current.filter((item) => item !== id))} />
            </div>
            <div className="sm:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#77736d]">Units the service applies to</p>
              <div className="mt-2 flex gap-2">
                <div className="min-w-0 flex-1"><FlowPointSelect value={unitToAdd} onChange={setUnitToAdd} placeholder="Select a unit" options={unitOptions.map((item) => ({ value: item.id, label: item.unit_number, secondary: properties.find((property) => property.id === item.property_id)?.name }))} emptyLabel="No unassigned units" /></div>
                <button type="button" onClick={() => { if (unitToAdd) { setUnitIds((current) => [...current, unitToAdd]); setUnitToAdd(''); } }} disabled={!unitToAdd} className="flex h-[39px] items-center gap-1 rounded-[9px] border border-[#e4e2de] px-3 text-[11px] font-semibold text-[#625e57] hover:bg-[#f4f2ef] disabled:opacity-40"><Plus size={12} />Add</button>
              </div>
              <SelectionChips labels={unitIds.map((id) => { const item = units.find((candidate) => candidate.id === id); return { id, label: item?.unit_number ?? 'Unit unavailable', secondary: item ? properties.find((property) => property.id === item.property_id)?.name ?? undefined : undefined }; })} onRemove={(id) => setUnitIds((current) => current.filter((item) => item !== id))} />
            </div>
          </div>
        )}

        <button onClick={() => setCustomerOpen((open) => !open)} className="mt-5 flex w-full items-center justify-between border-t border-[#ebe8e3] pt-4 text-left">
          <span>
            <span className="block text-[12px] font-semibold text-[#35322e]">Customer-facing information</span>
            <span className="mt-1 block text-[11px] text-[#9c978e]">Give customers and the future assistant a clear explanation of the offer</span>
          </span>
          {customerOpen ? <ChevronRight size={16} className="rotate-90 text-[#868178]" /> : <ChevronRight size={16} className="text-[#868178]" />}
        </button>
        {customerOpen && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Customer-facing description"><textarea className={textAreaClass} rows={3} value={form.customer_facing_description ?? ''} onChange={(event) => set('customer_facing_description', event.target.value)} placeholder="How the service should be described to a customer" /></Field></div>
            <Field label="Requirements / eligibility"><textarea className={textAreaClass} rows={3} value={form.requirements ?? ''} onChange={(event) => set('requirements', event.target.value)} placeholder="What a customer needs to qualify or provide" /></Field>
            <Field label="What is included"><textarea className={textAreaClass} rows={3} value={form.included_details ?? ''} onChange={(event) => set('included_details', event.target.value)} placeholder="Included work, support, or deliverables" /></Field>
            <Field label="What is not included"><textarea className={textAreaClass} rows={3} value={form.excluded_details ?? ''} onChange={(event) => set('excluded_details', event.target.value)} placeholder="Boundaries and exclusions" /></Field>
            <Field label="Pricing / fee information" hint="optional"><textarea className={textAreaClass} rows={3} value={form.pricing_information ?? ''} onChange={(event) => set('pricing_information', event.target.value)} placeholder="Leave blank when the service has no fixed price" /></Field>
          </div>
        )}

        <div className="mt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[.08em] text-[#77736d]">Contacts using this service</p>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1"><FlowPointSelect value={contactToAdd} onChange={setContactToAdd} placeholder="Select a contact" options={contactOptions.map((item) => ({ value: String(item.id), label: item.name, secondary: item.customer_id ?? item.contact_type ?? undefined }))} emptyLabel="No unassigned contacts" /></div>
            <button type="button" onClick={() => { if (contactToAdd) { setContactIds((current) => [...current, contactToAdd]); setContactToAdd(''); } }} disabled={!contactToAdd} className="flex h-[39px] items-center gap-1 rounded-[9px] border border-[#e4e2de] px-3 text-[11px] font-semibold text-[#625e57] hover:bg-[#f4f2ef] disabled:opacity-40"><Plus size={12} />Add</button>
          </div>
          <SelectionChips labels={contactIds.map((id) => { const item = contacts.find((candidate) => String(candidate.id) === id); return { id, label: item?.name ?? 'Contact unavailable', secondary: item?.customer_id ?? undefined }; })} onRemove={(id) => setContactIds((current) => current.filter((item) => item !== id))} />
        </div>

        {error && <div className="mt-4"><InlineError message={error} /></div>}
        <div className="mt-5 flex justify-end gap-2 border-t border-[#ebe8e3] pt-4">
          <button onClick={onClose} disabled={saving} className="h-9 rounded-[9px] border border-[#e4e2de] px-4 text-[12px] font-medium text-[#625e57] hover:bg-[#f0eeea] disabled:opacity-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="flex h-9 items-center gap-2 rounded-[9px] bg-[#151412] px-4 text-[12px] font-semibold text-white hover:bg-[#312f2c] disabled:opacity-50">{saving && <Loader2 size={13} className="animate-spin" />}{service ? 'Save changes' : 'Add service'}</button>
        </div>
      </div>
    </Modal>
  );
}

function ServiceCard({
  service,
  relationships,
  onOpen,
}: {
  service: Service;
  relationships: RelationshipState;
  onOpen: () => void;
}) {
  const contacts = relationships.contacts.filter((item) => item.service_id === service.id);
  const staff = relationships.staff.filter((item) => item.service_id === service.id);
  const properties = relationships.properties.filter((item) => item.service_id === service.id);
  const units = relationships.units.filter((item) => item.service_id === service.id);
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onOpen}
      className="group w-full rounded-[13px] border border-[#e9e6e1] bg-white p-4 text-left transition-all hover:-translate-y-[1px] hover:border-[#d2cec7] hover:shadow-[0_6px_22px_rgba(31,28,23,.06)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-[#f1eee9] text-[#706b62]"><BriefcaseBusiness size={17} strokeWidth={1.7} /></div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-[#171512]">{service.name}</p>
            <p className="mt-1 truncate text-[11px] text-[#97928a]">{service.category}</p>
          </div>
        </div>
        <StatusPill status={service.status} />
      </div>
      <p className="mt-3 line-clamp-2 min-h-[34px] text-[11px] leading-[1.55] text-[#77736d]">{service.short_description || service.description || 'No description has been documented yet.'}</p>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-[#f0eeeb] pt-3 text-[10px] text-[#8e8981]">
        <span className="flex items-center gap-1"><Users2 size={11} />{contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'}</span>
        <span className="flex items-center gap-1"><Building2 size={11} />{properties.length} {properties.length === 1 ? 'property' : 'properties'}</span>
        <span className="flex items-center gap-1"><Home size={11} />{units.length} {units.length === 1 ? 'unit' : 'units'}</span>
        <span className="flex items-center gap-1"><UserRound size={11} />{staff.length} assigned</span>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-[#f0eeeb] pt-3 text-[10px] text-[#aaa59d]">
        <span className="flex items-center gap-1"><Clock3 size={10} />Updated {new Date(service.updated_at).toLocaleDateString()}</span>
        <ChevronRight size={14} className="text-[#bbb6ae] transition-transform group-hover:translate-x-0.5" />
      </div>
    </motion.button>
  );
}

function ServiceProfile({
  service,
  relationships,
  onClose,
  onEdit,
  onDelete,
}: {
  service: Service;
  relationships: RelationshipState;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [tab, setTab] = useState<'overview' | 'people' | 'places' | 'team' | 'instructions' | 'activity'>('overview');
  const [issues, setIssues] = useState<RequestRecord[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const contacts = relationships.contacts.filter((item) => item.service_id === service.id);
  const staff = relationships.staff.filter((item) => item.service_id === service.id);
  const properties = relationships.properties.filter((item) => item.service_id === service.id);
  const units = relationships.units.filter((item) => item.service_id === service.id);
  useEffect(() => {
    if (tab !== 'activity') return;
    let active = true;
    setIssuesLoading(true);
    supabase.from('requests').select('*').eq('service_id', service.id).order('updated_at', { ascending: false })
      .then(({ data }) => { if (active) { setIssues((data as RequestRecord[]) ?? []); setIssuesLoading(false); } });
    return () => { active = false; };
  }, [tab, service.id]);
  const tabs = [
    ['overview', 'Overview'],
    ['people', 'People'],
    ['places', 'Properties / Units'],
    ['team', 'Team'],
    ['instructions', 'Instructions'],
    ['activity', 'Activity'],
  ] as const;
  return (
    <Modal onClose={onClose} extraWide>
      <div className="flex items-start justify-between border-b border-[#ebe8e3] px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[12px] bg-[#f1eee9] text-[#706b62]"><BriefcaseBusiness size={20} /></div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><p className="truncate text-[16px] font-semibold text-[#151412]">{service.name}</p><StatusPill status={service.status} /></div>
            <p className="mt-1 text-[11px] text-[#8b877f]">{service.category} · Updated {new Date(service.updated_at).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onEdit} className="flex h-8 items-center gap-1.5 rounded-[8px] border border-[#e4e2de] px-2.5 text-[11px] font-medium text-[#625e57] hover:bg-[#f0eeea]"><Pencil size={12} />Edit</button>
          <button onClick={onDelete} className="flex h-8 items-center gap-1.5 rounded-[8px] border border-[#f0c8c3] px-2.5 text-[11px] font-medium text-[#a33a30] hover:bg-[#fff7f6]"><Trash2 size={12} />Delete</button>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full border border-[#e4e2de] text-[#817d76] hover:bg-[#f0eeea]"><X size={14} /></button>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-[#ebe8e3] px-5 pt-2">{tabs.map(([value, label]) => <button key={value} onClick={() => setTab(value)} className={`whitespace-nowrap border-b-2 px-2 pb-2.5 text-[11px] font-semibold transition-colors ${tab === value ? 'border-[#151412] text-[#151412]' : 'border-transparent text-[#9a958d] hover:text-[#4d4942]'}`}>{label}</button>)}</div>
      <div className="max-h-[calc(92vh-138px)] overflow-y-auto px-5 py-5">
        {tab === 'overview' && <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><div className="rounded-[11px] border border-[#e9e6e1] bg-white p-4"><p className="mb-3 text-[12px] font-semibold text-[#35322e]">Service details</p><Detail label="Category" value={service.category} /><Detail label="Status" value={serviceStatusLabel(service.status)} /><Detail label="Short description" value={service.short_description} /><Detail label="Detailed description" value={service.description} /></div><div className="rounded-[11px] border border-[#e9e6e1] bg-white p-4"><p className="mb-3 text-[12px] font-semibold text-[#35322e]">Customer-facing information</p><Detail label="Description" value={service.customer_facing_description} /><Detail label="Requirements" value={service.requirements} /><Detail label="Included" value={service.included_details} /><Detail label="Not included" value={service.excluded_details} /><Detail label="Pricing" value={service.pricing_information} /></div></div>}
        {tab === 'people' && <div className="space-y-2">{contacts.length ? contacts.map((item) => <div key={String(item.id)} className="flex items-center justify-between rounded-[11px] border border-[#e9e6e1] bg-white p-3"><div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ece8e1] text-[#706b62]"><UserRound size={15} /></div><div><p className="text-[12px] font-semibold text-[#35322e]">{item.contact?.name ?? 'Contact unavailable'}</p><p className="mt-1 text-[10px] text-[#8e8981]">{item.contact?.contact_type ?? 'Contact'} · {item.contact?.customer_id ?? 'Customer ID unavailable'}</p></div></div><span className="text-[10px] text-[#aaa59d]">{item.relationship_status ?? 'Active relationship'}</span></div>) : <EmptyState icon={Users2} title="No contacts use this service yet" description="Add contacts from the service editor when this offering is assigned." />}</div>}
        {tab === 'places' && <div className="space-y-4"><div><p className="mb-2 text-[12px] font-semibold text-[#35322e]">Properties</p>{properties.length ? <div className="grid grid-cols-1 gap-2 md:grid-cols-2">{properties.map((item) => <div key={String(item.id)} className="rounded-[11px] border border-[#e9e6e1] bg-white p-3"><p className="text-[12px] font-semibold text-[#35322e]">{item.property?.name ?? 'Property unavailable'}</p><p className="mt-1 flex items-center gap-1 text-[10px] text-[#8e8981]"><MapPin size={10} />{[item.property?.city, item.property?.address_line1].filter(Boolean).join(' · ') || 'Address unavailable'}</p></div>)}</div> : <p className="rounded-[10px] border border-dashed border-[#d9d5ce] px-4 py-6 text-center text-[11px] text-[#97928a]">No properties associated.</p>}</div><div><p className="mb-2 text-[12px] font-semibold text-[#35322e]">Units</p>{units.length ? <div className="grid grid-cols-1 gap-2 md:grid-cols-2">{units.map((item) => <div key={String(item.id)} className="rounded-[11px] border border-[#e9e6e1] bg-white p-3"><p className="text-[12px] font-semibold text-[#35322e]">Unit {item.unit?.unit_number ?? 'Unavailable'}</p><p className="mt-1 text-[10px] text-[#8e8981]">{item.unit?.property?.name ?? 'Property unavailable'}</p></div>)}</div> : <p className="rounded-[10px] border border-dashed border-[#d9d5ce] px-4 py-6 text-center text-[11px] text-[#97928a]">No units associated.</p>}</div></div>}
        {tab === 'team' && <div className="space-y-2">{staff.length ? staff.map((item) => <div key={String(item.id)} className="flex items-center justify-between rounded-[11px] border border-[#e9e6e1] bg-white p-3"><div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ece8e1] text-[#706b62]"><Users2 size={15} /></div><div><p className="text-[12px] font-semibold text-[#35322e]">{item.staff?.name ?? 'Staff unavailable'}</p><p className="mt-1 text-[10px] text-[#8e8981]">{item.staff?.role ?? 'Role not set'}{item.staff?.department ? ` · ${item.staff.department}` : ''}</p></div></div><span className="text-[10px] text-[#aaa59d]">{item.assignment_role ?? 'Responsible team member'}</span></div>) : <EmptyState icon={Users2} title="No staff assigned yet" description="Assign responsible staff members from the service editor." />}</div>}
        {tab === 'instructions' && <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><div className="rounded-[11px] border border-[#e9e6e1] bg-white p-4"><p className="mb-3 text-[12px] font-semibold text-[#35322e]">Operations</p><Detail label="Availability / eligibility" value={service.availability_information} /><Detail label="Typical response time" value={service.typical_response_time} /><Detail label="Internal instructions" value={service.internal_instructions} /></div><div className="rounded-[11px] border border-[#e9e6e1] bg-white p-4"><p className="mb-3 text-[12px] font-semibold text-[#35322e]">Escalation</p><Detail label="Requirements" value={service.requirements} /><Detail label="Escalation instructions" value={service.escalation_instructions} /></div></div>}
         {tab === 'activity' && <div className="rounded-[11px] border border-[#e9e6e1] bg-white p-4"><div className="mb-4 flex items-center justify-between"><div><p className="text-[12px] font-semibold text-[#35322e]">Related requests / issues</p><p className="mt-1 text-[11px] text-[#9b968d]">Requests connected to this service.</p></div><Clock3 size={16} className="text-[#aaa59d]" /></div>{issuesLoading ? <p className="text-[11px] text-[#9b968d]">Loading requests…</p> : issues.length === 0 ? <p className="rounded-[10px] border border-dashed border-[#d9d5ce] px-4 py-8 text-center text-[11px] text-[#97928a]">No requests linked to this service.</p> : <div className="space-y-2">{issues.map((issue) => <div key={issue.id} className="rounded-[10px] border border-[#f0eeeb] p-3"><div className="flex items-start justify-between gap-3"><p className="truncate text-[12px] font-semibold text-[#35322e]">{issue.title}</p><div className="flex gap-1.5"><span className="rounded-full border border-[#e3dfd9] bg-[#f5f3f0] px-2 py-0.5 text-[10px] font-semibold text-[#77736d]">{requestStatusLabel(issue.status)}</span><span className="rounded-full border border-[#e3dfd9] bg-[#f5f3f0] px-2 py-0.5 text-[10px] font-semibold text-[#77736d]">{requestPriorityLabel(issue.priority)}</span></div></div><p className="mt-1 text-[10px] text-[#9b968d]">{ageLabel(issue.created_at, issue.closed_at)}</p></div>)}</div>}</div>}
      </div>
    </Modal>
  );
}

function ConfirmDelete({ name, deleting, onCancel, onConfirm }: { name: string; deleting: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={deleting ? undefined : onCancel} className="absolute inset-0 bg-[#171511]/30 backdrop-blur-[2px]" /><motion.div initial={{ opacity: 0, y: 8, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="relative w-full max-w-[380px] rounded-[16px] border border-[#e4e2de] bg-[#fbfaf8] p-6 text-center shadow-[0_24px_80px_rgba(25,22,18,.18)]"><div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-[#f0cbc6] bg-[#fff3f1] text-[#b33d32]"><Trash2 size={17} /></div><h2 className="mt-4 text-[15px] font-semibold text-[#24211e]">Delete {name}?</h2><p className="mt-1 text-[12px] leading-[1.5] text-[#8f8980]">This removes the service and its relational assignments. This action cannot be undone.</p><div className="mt-5 flex gap-2"><button onClick={onCancel} disabled={deleting} className="h-9 flex-1 rounded-[9px] border border-[#e4e2de] text-[12px] font-medium text-[#625e57] hover:bg-[#f0eeea] disabled:opacity-50">Cancel</button><button onClick={onConfirm} disabled={deleting} className="flex h-9 flex-1 items-center justify-center gap-2 rounded-[9px] bg-[#b33d32] text-[12px] font-semibold text-white hover:bg-[#96342b] disabled:opacity-50">{deleting && <Loader2 size={13} className="animate-spin" />}Delete</button></div></motion.div></div>;
}

async function syncRelationshipTable(
  table: string,
  serviceId: string,
  key: string,
  selectedIds: string[],
  currentIds: string[],
) {
  const selected = new Set(selectedIds);
  const removed = currentIds.filter((id) => !selected.has(id));
  const added = selectedIds.filter((id) => !currentIds.includes(id));
  if (removed.length) {
    const { error } = await supabase.from(table).delete().eq('service_id', serviceId).in(key, removed);
    if (error) throw new Error(error.message);
  }
  if (added.length) {
    const { error } = await supabase.from(table).insert(added.map((id) => ({ service_id: serviceId, [key]: id })));
    if (error) throw new Error(error.message);
  }
}

export default function ServicesPage() {
  useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [relationships, setRelationships] = useState<RelationshipState>({ contacts: [], staff: [], properties: [], units: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formService, setFormService] = useState<Service | null | undefined>(undefined);
  const [profileService, setProfileService] = useState<Service | null>(null);
  const [deleteService, setDeleteService] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [servicesResult, contactsResult, staffResult, propertiesResult, unitsResult, contactLinks, staffLinks, propertyLinks, unitLinks] = await Promise.all([
      supabase.from('services').select('*').order('name'),
      supabase.from('contacts').select('*').order('name'),
      supabase.from('staff').select('*').order('name'),
      supabase.from('properties').select('*').order('name'),
      supabase.from('units').select('*').order('unit_number'),
      supabase.from('contact_services').select('id, company_id, service_id, contact_id, relationship_status, notes, contact:contacts(id, name, customer_id, contact_type, status)'),
      supabase.from('service_staff').select('id, company_id, service_id, staff_id, assignment_role, notes, staff:staff(id, name, role, department, status)'),
      supabase.from('service_properties').select('id, company_id, service_id, property_id, notes, property:properties(id, name, city, address_line1)'),
      supabase.from('service_units').select('id, company_id, service_id, unit_id, notes, unit:units(id, unit_number, property_id, property:properties(id, name))'),
    ]);
    if (servicesResult.error) setError(servicesResult.error.message); else setServices((servicesResult.data as Service[]) ?? []);
    if (!contactsResult.error) setContacts((contactsResult.data as Contact[]) ?? []);
    if (!staffResult.error) setStaff((staffResult.data as Staff[]) ?? []);
    if (!propertiesResult.error) setProperties((propertiesResult.data as Property[]) ?? []);
    if (!unitsResult.error) setUnits((unitsResult.data as Unit[]) ?? []);
    const relationshipError = [contactLinks, staffLinks, propertyLinks, unitLinks].find((result) => result.error)?.error;
    if (relationshipError) setError((current) => current ?? relationshipError.message);
    setRelationships({
      contacts: (contactLinks.data as unknown as ServiceContactRelationship[]) ?? [],
      staff: (staffLinks.data as unknown as ServiceStaffRelationship[]) ?? [],
      properties: (propertyLinks.data as unknown as ServicePropertyRelationship[]) ?? [],
      units: (unitLinks.data as unknown as ServiceUnitRelationship[]) ?? [],
    });
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const saveService = async (draft: ServiceDraft, selected: { contactIds: string[]; staffIds: string[]; propertyIds: string[]; unitIds: string[] }) => {
    let saved: Service;
    if (formService) {
      const { data, error: saveError } = await supabase.from('services').update(draft).eq('id', formService.id).select().single();
      if (saveError) throw new Error(saveError.message);
      saved = data as Service;
    } else {
      const { data, error: saveError } = await supabase.from('services').insert([draft]).select().single();
      if (saveError) throw new Error(saveError.message);
      saved = data as Service;
    }
    const current = {
      contactIds: relationships.contacts.filter((item) => item.service_id === saved.id).map((item) => String(item.contact_id)),
      staffIds: relationships.staff.filter((item) => item.service_id === saved.id).map((item) => String(item.staff_id)),
      propertyIds: relationships.properties.filter((item) => item.service_id === saved.id).map((item) => item.property_id),
      unitIds: relationships.units.filter((item) => item.service_id === saved.id).map((item) => item.unit_id),
    };
    await syncRelationshipTable('contact_services', saved.id, 'contact_id', selected.contactIds, current.contactIds);
    await syncRelationshipTable('service_staff', saved.id, 'staff_id', selected.staffIds, current.staffIds);
    await syncRelationshipTable('service_properties', saved.id, 'property_id', selected.propertyIds, current.propertyIds);
    await syncRelationshipTable('service_units', saved.id, 'unit_id', selected.unitIds, current.unitIds);
    await loadData();
    setProfileService(saved);
    setFeedback({ tone: 'success', message: formService ? 'Service changes saved.' : 'Service added.' });
  };

  const deleteSelected = async () => {
    if (!deleteService) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('services').delete().eq('id', deleteService.id);
    if (deleteError) {
      setFeedback({ tone: 'error', message: deleteError.message });
      setDeleting(false);
      return;
    }
    setServices((current) => current.filter((item) => item.id !== deleteService.id));
    setRelationships((current) => ({
      contacts: current.contacts.filter((item) => item.service_id !== deleteService.id),
      staff: current.staff.filter((item) => item.service_id !== deleteService.id),
      properties: current.properties.filter((item) => item.service_id !== deleteService.id),
      units: current.units.filter((item) => item.service_id !== deleteService.id),
    }));
    setDeleteService(null);
    setProfileService(null);
    setDeleting(false);
    setFeedback({ tone: 'success', message: 'Service deleted.' });
  };

  const categories = useMemo(() => [...new Set(services.map((item) => item.category).filter(Boolean))].sort().map((value) => ({ value, label: value })), [services]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return services.filter((service) => {
      const haystack = [service.name, service.category, service.short_description, service.description].filter(Boolean).join(' ').toLowerCase();
      return (!needle || haystack.includes(needle)) && (!categoryFilter || service.category === categoryFilter) && (!statusFilter || service.status === statusFilter);
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [services, search, categoryFilter, statusFilter]);
  const clearFilters = () => { setSearch(''); setCategoryFilter(''); setStatusFilter(''); };

  return (
    <AppLayout>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8f7f5]">
        <header className="flex flex-shrink-0 items-center justify-between border-b border-[#e9e6e1] bg-[#fbfaf8] px-5 py-4 sm:px-8">
          <div><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#a19c93]">Operations and knowledge</p><h1 className="mt-1 text-[20px] font-semibold tracking-[-.02em] text-[#151412]">Services</h1><p className="mt-1 max-w-[720px] text-[12px] text-[#77736d]">Keep the company’s offerings structured so your team and FlowPoint AI know what is provided, who it serves, and how work should be handled.</p></div>
          <div className="flex items-center gap-2"><NotificationBell /><button onClick={() => setFormService(null)} className="flex h-9 items-center gap-2 rounded-[9px] bg-[#151412] px-3.5 text-[12px] font-semibold text-white shadow-[0_2px_5px_rgba(0,0,0,.12)] hover:bg-[#312f2c]"><Plus size={14} />Add service</button></div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1240px] px-5 py-6 sm:px-8 sm:py-8">
            {feedback && <div className={`mb-5 flex items-center justify-between rounded-[10px] border px-3 py-2.5 text-[12px] ${feedback.tone === 'success' ? 'border-[#d2ead7] bg-[#f2faf3] text-[#327443]' : 'border-[#f0c8c3] bg-[#fff7f6] text-[#a33a30]'}`}><span className="flex items-center gap-2">{feedback.tone === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}{feedback.message}</span><button onClick={() => setFeedback(null)}><X size={14} /></button></div>}
            <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
              <div><p className="text-[13px] text-[#706c64]">A shared catalog of the work your company can provide.</p><p className="mt-1 text-[11px] text-[#a19c93]">{services.length} {services.length === 1 ? 'service' : 'services'} documented</p></div>
              <div className="flex flex-col gap-2 sm:flex-row"><label className="relative block min-w-[240px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a8a39b]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search service or category" className={`${inputClass} pl-9`} /></label><div className="flex gap-2"><div className="min-w-[140px]"><FlowPointSelect value={categoryFilter} onChange={setCategoryFilter} placeholder="All categories" options={categories} emptyLabel="No categories yet" /></div><div className="min-w-[132px]"><FlowPointSelect value={statusFilter} onChange={setStatusFilter} placeholder="All statuses" options={SERVICE_STATUSES.map((item) => ({ ...item }))} /></div><button onClick={clearFilters} className="flex h-[39px] items-center justify-center gap-2 rounded-[9px] border border-[#e4e2de] px-3 text-[12px] font-medium text-[#625e57] hover:bg-[#f4f2ef]"><Filter size={13} />Clear</button><button onClick={loadData} disabled={loading} className="flex h-[39px] items-center justify-center rounded-[9px] border border-[#e4e2de] px-3 text-[#817d76] hover:bg-[#f4f2ef] disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button></div></div>
            </div>
            {loading && <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="h-[185px] animate-pulse rounded-[13px] border border-[#eeeae5] bg-[#f0eeeb]" />)}</div>}
            {!loading && error && <div className="mb-5"><InlineError message={error} /></div>}
            {!loading && !error && services.length === 0 && <EmptyState title="No services yet" description="Add the first offering to give your company a structured source of truth for operations and future AI assistance." />}
            {!loading && !error && services.length > 0 && filtered.length === 0 && <div className="rounded-[14px] border border-[#e9e6e1] bg-white px-6 py-16 text-center"><Filter size={20} className="mx-auto text-[#bbb6ae]" /><p className="mt-3 text-[13px] font-semibold text-[#4a4741]">No matching services</p><p className="mt-1 text-[12px] text-[#99948b]">Try a different search or clear one of the filters.</p><button onClick={clearFilters} className="mt-4 text-[12px] font-semibold text-[#4a4741] underline underline-offset-2">Clear filters</button></div>}
            {!loading && !error && filtered.length > 0 && <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"><AnimatePresence mode="popLayout">{filtered.map((service) => <ServiceCard key={service.id} service={service} relationships={relationships} onOpen={() => setProfileService(service)} />)}</AnimatePresence></div>}
          </div>
        </div>
        <AnimatePresence>{formService !== undefined && <ServiceForm service={formService} relationships={relationships} contacts={contacts} staff={staff} properties={properties} units={units} onSave={saveService} onClose={() => setFormService(undefined)} />}</AnimatePresence>
        <AnimatePresence>{profileService && <ServiceProfile service={profileService} relationships={relationships} onClose={() => setProfileService(null)} onEdit={() => setFormService(profileService)} onDelete={() => setDeleteService(profileService)} />}</AnimatePresence>
        <AnimatePresence>{deleteService && <ConfirmDelete name={deleteService.name} deleting={deleting} onCancel={() => setDeleteService(null)} onConfirm={deleteSelected} />}</AnimatePresence>
      </div>
    </AppLayout>
  );
}