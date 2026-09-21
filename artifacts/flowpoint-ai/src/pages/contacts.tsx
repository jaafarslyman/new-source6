import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Archive,
  Building2,
  CalendarDays,
  Check,
  Clock3,
  Home,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  StickyNote,
  Trash2,
  UserRound,
  Users2,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import FlowPointSelect from '@/components/FlowPointSelect';
import NotificationBell from '@/components/NotificationBell';
import PageFilterMenu from '@/components/PageFilterMenu';
import { supabase } from '@/lib/supabase';
import type { InboxEmail } from '@/lib/inboxTypes';
import type { Property } from '@/lib/propertiesTypes';
import type { Unit } from '@/lib/unitsTypes';
import {
  CONTACT_STATUSES,
  CONTACT_TYPES,
  PREFERRED_CHANNELS,
  RELATIONSHIP_TYPES,
  channelLabel,
  contactStatusLabel,
  contactTypeLabel,
  relationshipTypeLabel,
  type Contact,
  type ContactDraft,
  type ContactPropertyRelationship,
  type ContactPropertyRelationshipHistory,
  type RelationshipType,
} from '@/lib/contactsTypes';
import type { Service, ServiceContactRelationship } from '@/lib/servicesTypes';
import { pushSingleNotification } from '@/lib/notificationHelpers';
import { ageLabel, requestPriorityLabel, requestStatusLabel, type RequestRecord } from '@/lib/requestsTypes';
import { useLocation } from 'wouter';

const inputClass =
  'w-full h-[39px] rounded-[9px] border border-[#e4e2de] bg-white px-[11px] text-[13px] text-[#151412] outline-none placeholder:text-[#b3b0aa] focus:border-[#151412] focus:ring-2 focus:ring-[#151412]/8 transition-all';
const textAreaClass =
  'w-full rounded-[9px] border border-[#e4e2de] bg-white px-[11px] py-[9px] text-[13px] leading-[1.5] text-[#151412] outline-none placeholder:text-[#b3b0aa] focus:border-[#151412] focus:ring-2 focus:ring-[#151412]/8 transition-all resize-none';

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function avatarStyle(name: string): React.CSSProperties {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash << 5) - hash + name.charCodeAt(index);
    hash |= 0;
  }
  const colors = ['#5f6f52', '#7d5a50', '#4f6d7a', '#8064a2', '#8a6d3b', '#517a69'];
  return { background: colors[Math.abs(hash) % colors.length] };
}

function Avatar({ name, size = 42 }: { name: string; size?: number }) {
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ ...avatarStyle(name), width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.32)) }}
    >
      {initials(name)}
    </div>
  );
}

function contactRelationshipSummaries(
  contact: Contact,
  relationships: ContactPropertyRelationship[],
  properties: Property[],
  units: Unit[],
) {
  const groups = new Map<string, { property?: Property; unitNumbers: Set<string>; scopes: Set<string>; types: Set<string> }>();
  relationships.filter((item) => item.contact_id === contact.id).forEach((relationship) => {
    const key = relationship.property_id;
    const group = groups.get(key) ?? {
      property: properties.find((property) => property.id === relationship.property_id),
      unitNumbers: new Set<string>(),
      scopes: new Set<string>(),
      types: new Set<string>(),
    };
    const unit = relationship.unit ?? units.find((item) => item.id === relationship.unit_id);
    if (unit?.unit_number) group.unitNumbers.add(unit.unit_number);
    if (relationship.ownership_scope) group.scopes.add(relationship.ownership_scope);
    group.types.add(relationship.relationship_type);
    groups.set(key, group);
  });
  return [...groups.values()];
}

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
          extraWide ? 'max-w-[980px]' : wide ? 'max-w-[720px]' : 'max-w-[540px]'
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

function FormError({ message }: { message?: string }) {
  return message ? (
    <p className="mt-1 flex items-center gap-1 text-[11px] text-[#b33d32]">
      <AlertCircle size={11} />
      {message}
    </p>
  ) : null;
}

function StatusPill({ status }: { status: string | null | undefined }) {
  const style =
    status === 'active'
      ? 'border-[#d2ead7] bg-[#f2faf3] text-[#327443]'
      : status === 'archived'
        ? 'border-[#e5e1dc] bg-[#f1f0ee] text-[#77736d]'
        : 'border-[#f1dfb8] bg-[#fff7e6] text-[#a36810]';
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${style}`}>
      {contactStatusLabel(status)}
    </span>
  );
}

function ContactForm({
  contact,
  onSave,
  onClose,
}: {
  contact: Contact | null;
  onSave: (draft: ContactDraft) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ContactDraft>(() => ({
    name: contact?.name ?? '',
    email: contact?.email ?? '',
    phone: contact?.phone ?? '',
    business_name: contact?.business_name ?? '',
    notes: contact?.notes ?? '',
    customer_id: contact?.customer_id ?? '',
    contact_type: contact?.contact_type ?? 'other',
    status: contact?.status ?? 'active',
    preferred_channel: contact?.preferred_channel ?? 'email',
    alternate_phone: contact?.alternate_phone ?? '',
    address: contact?.address ?? '',
    city: contact?.city ?? '',
    state: contact?.state ?? '',
    zip_code: contact?.zip_code ?? '',
    country: contact?.country ?? '',
    company_name: contact?.company_name ?? contact?.business_name ?? '',
    ai_summary: contact?.ai_summary ?? '',
    internal_notes: contact?.internal_notes ?? '',
    last_contacted_at: contact?.last_contacted_at ?? null,
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof ContactDraft>(key: K, value: ContactDraft[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Name is required';
    if (!form.email?.trim() && !form.phone?.trim() && !form.alternate_phone?.trim()) {
      next.identifier = 'Add an email, phone, or alternate phone';
    }
    if (form.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = 'Enter a valid email';
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    setSaveError(null);
    try {
      await onSave({
        ...form,
        name: form.name.trim(),
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        alternate_phone: form.alternate_phone?.trim() || null,
        business_name: form.company_name?.trim() || form.business_name?.trim() || null,
        company_name: form.company_name?.trim() || null,
        notes: form.notes?.trim() || null,
        address: form.address?.trim() || null,
        city: form.city?.trim() || null,
        state: form.state?.trim() || null,
        zip_code: form.zip_code?.trim() || null,
        country: form.country?.trim() || null,
        ai_summary: form.ai_summary?.trim() || null,
        internal_notes: form.internal_notes?.trim() || null,
        customer_id: contact ? contact.customer_id : null,
      });
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save contact');
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} wide>
      <div className="flex items-center justify-between border-b border-[#ebe8e3] px-5 py-4">
        <div>
          <p className="text-[15px] font-semibold text-[#151412]">{contact ? 'Edit contact' : 'Add contact'}</p>
          <p className="mt-1 text-[11px] text-[#8b877f]">
            Keep identity, communication preferences, and private context together.
          </p>
        </div>
        <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full border border-[#e4e2de] text-[#817d76] hover:bg-[#f0eeea]">
          <X size={14} />
        </button>
      </div>
      <div className="max-h-[calc(92vh-72px)] overflow-y-auto px-5 py-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="mb-3 border-b border-[#ebe8e3] pb-2 text-[12px] font-semibold text-[#35322e]">Identity</p>
          </div>
          <Field label={form.contact_type === 'company' ? 'Company name' : 'Full name'}>
            <input autoFocus className={inputClass} value={form.name} onChange={(event) => set('name', event.target.value)} placeholder={form.contact_type === 'company' ? 'Company name' : 'Full name'} />
            <FormError message={errors.name} />
          </Field>
          <Field label="Contact type">
            <FlowPointSelect value={form.contact_type ?? ''} onChange={(value) => set('contact_type', value as ContactDraft['contact_type'])} placeholder="Select type" options={CONTACT_TYPES.map((item) => ({ ...item }))} />
          </Field>
          <Field label="Status">
            <FlowPointSelect value={form.status ?? ''} onChange={(value) => set('status', value as ContactDraft['status'])} placeholder="Select status" options={CONTACT_STATUSES.map((item) => ({ ...item }))} />
          </Field>
          <Field label="Customer ID" hint={contact ? 'read-only' : 'generated on save'}>
            <input className={`${inputClass} bg-[#f4f2ef] text-[#77736d]`} value={contact?.customer_id ?? 'Generated automatically'} readOnly />
          </Field>
          <div className="sm:col-span-2">
            <p className="mb-3 mt-2 border-b border-[#ebe8e3] pb-2 text-[12px] font-semibold text-[#35322e]">Contact information</p>
          </div>
          <Field label="Email" hint="optional">
            <input type="email" className={inputClass} value={form.email ?? ''} onChange={(event) => set('email', event.target.value)} placeholder="person@example.com" />
            <FormError message={errors.email} />
          </Field>
          <Field label="Phone" hint="optional">
            <input type="tel" className={inputClass} value={form.phone ?? ''} onChange={(event) => set('phone', event.target.value)} placeholder="+1 555 000 0000" />
          </Field>
          <Field label="Alternate phone" hint="optional">
            <input type="tel" className={inputClass} value={form.alternate_phone ?? ''} onChange={(event) => set('alternate_phone', event.target.value)} placeholder="Secondary number" />
          </Field>
          <Field label="Preferred channel">
            <FlowPointSelect value={form.preferred_channel ?? ''} onChange={(value) => set('preferred_channel', value as ContactDraft['preferred_channel'])} placeholder="Select channel" options={PREFERRED_CHANNELS.map((item) => ({ ...item }))} />
          </Field>
          {errors.identifier && <p className="sm:col-span-2 text-[11px] text-[#b33d32]">{errors.identifier}</p>}
          <div className="sm:col-span-2">
            <p className="mb-3 mt-2 border-b border-[#ebe8e3] pb-2 text-[12px] font-semibold text-[#35322e]">Organization and address</p>
          </div>
          <Field label="Company / organization" hint="optional">
            <input className={inputClass} value={form.company_name ?? ''} onChange={(event) => set('company_name', event.target.value)} placeholder="Company or organization" />
          </Field>
          <Field label="Country" hint="optional">
            <input className={inputClass} value={form.country ?? ''} onChange={(event) => set('country', event.target.value)} placeholder="Country" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Address" hint="optional">
              <input className={inputClass} value={form.address ?? ''} onChange={(event) => set('address', event.target.value)} placeholder="Street address" />
            </Field>
          </div>
          <Field label="City" hint="optional">
            <input className={inputClass} value={form.city ?? ''} onChange={(event) => set('city', event.target.value)} placeholder="City" />
          </Field>
          <Field label="State / region" hint="optional">
            <input className={inputClass} value={form.state ?? ''} onChange={(event) => set('state', event.target.value)} placeholder="State or region" />
          </Field>
          <Field label="ZIP / postal code" hint="optional">
            <input className={inputClass} value={form.zip_code ?? ''} onChange={(event) => set('zip_code', event.target.value)} placeholder="ZIP or postal code" />
          </Field>
          <div className="sm:col-span-2">
            <p className="mb-3 mt-2 border-b border-[#ebe8e3] pb-2 text-[12px] font-semibold text-[#35322e]">Internal context</p>
          </div>
          <div className="sm:col-span-2">
            <Field label="AI summary" hint="optional">
              <textarea className={textAreaClass} rows={3} value={form.ai_summary ?? ''} onChange={(event) => set('ai_summary', event.target.value)} placeholder="Context the assistant should know about this person" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Internal notes" hint="private">
              <textarea className={textAreaClass} rows={3} value={form.internal_notes ?? ''} onChange={(event) => set('internal_notes', event.target.value)} placeholder="Private notes for the team" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Legacy notes" hint="optional">
              <textarea className={textAreaClass} rows={2} value={form.notes ?? ''} onChange={(event) => set('notes', event.target.value)} placeholder="Existing contact notes" />
            </Field>
          </div>
        </div>
        {saveError && <div className="mt-4 flex items-start gap-2 rounded-[9px] border border-[#f0c8c3] bg-[#fff7f6] px-3 py-2.5 text-[12px] text-[#a33a30]"><AlertCircle size={14} className="mt-0.5 flex-shrink-0" />{saveError}</div>}
        <div className="mt-5 flex justify-end gap-2 border-t border-[#ebe8e3] pt-4">
          <button onClick={onClose} disabled={saving} className="h-9 rounded-[9px] border border-[#e4e2de] px-4 text-[12px] font-medium text-[#625e57] hover:bg-[#f0eeea] disabled:opacity-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="flex h-9 items-center gap-2 rounded-[9px] bg-[#151412] px-4 text-[12px] font-semibold text-white hover:bg-[#312f2c] disabled:opacity-50">{saving && <Loader2 size={13} className="animate-spin" />}{contact ? 'Save changes' : 'Add contact'}</button>
        </div>
      </div>
    </Modal>
  );
}

function ContactCard({
  contact,
  relationships,
  properties,
  units,
  serviceRelationships,
  services,
  onOpen,
  onEdit,
  onDelete,
  onNotes,
}: {
  contact: Contact;
  relationships: ContactPropertyRelationship[];
  properties: Property[];
  units: Unit[];
  serviceRelationships: ServiceContactRelationship[];
  services: Service[];
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onNotes: () => void;
}) {
  const linked = relationships.filter((item) => item.contact_id === contact.id);
  const ownerRelationships = linked.filter((item) => item.relationship_type === 'owner');
  const relationshipSummaries = contactRelationshipSummaries(contact, relationships, properties, units);
  const linkedServices = serviceRelationships.filter((item) => String(item.contact_id) === String(contact.id));
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onOpen}
      className="group w-full rounded-[13px] border border-[#e9e6e1] bg-white p-4 text-left transition-all hover:-translate-y-[1px] hover:border-[#d2cec7] hover:shadow-[0_6px_22px_rgba(31,28,23,.06)]"
    >
      <div className="flex items-start gap-3">
        <Avatar name={contact.name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-[#171512]">{contact.name}</p>
              <p className="mt-1 text-[10px] font-medium text-[#9a958d]">{contact.customer_id ?? 'Customer ID pending'}</p>
            </div>
            <StatusPill status={contact.status} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#77736d]">
            <span className="font-medium text-[#4d4942]">{contactTypeLabel(contact.contact_type)}</span>
             {ownerRelationships.length > 0 && <span className="rounded-full border border-[#d6ecd9] bg-[#edf7ef] px-2 py-0.5 text-[10px] font-semibold text-[#327443]">Property owner</span>}
            {contact.email && <span className="flex items-center gap-1"><Mail size={11} />{contact.email}</span>}
            {contact.phone && <span className="flex items-center gap-1"><Phone size={11} />{contact.phone}</span>}
          </div>
          {contact.company_name || contact.business_name ? <p className="mt-2 flex items-center gap-1 truncate text-[11px] text-[#8e8981]"><Building2 size={11} />{contact.company_name ?? contact.business_name}</p> : null}
          <div className="mt-3 flex flex-wrap gap-1.5">
             {relationshipSummaries.slice(0, 2).map((summary, index) => <span key={`${summary.property?.id ?? 'property'}-${index}`} className="flex items-center gap-1 rounded-full border border-[#e9e6e1] bg-[#faf9f7] px-2 py-1 text-[10px] text-[#706b62]"><Home size={10} /><span className="truncate">{summary.property?.name ?? 'Property'}{summary.unitNumbers.size ? ` · Units ${[...summary.unitNumbers].join(', ')}` : summary.scopes.size ? ` · ${[...summary.scopes][0]}` : ''}</span></span>)}
             {relationshipSummaries.length > 2 && <span className="rounded-full border border-[#e9e6e1] bg-[#faf9f7] px-2 py-1 text-[10px] text-[#706b62]">+{relationshipSummaries.length - 2} more</span>}
            {linked.length === 0 && <span className="text-[10px] italic text-[#aaa59d]">No property relationship</span>}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-[#f0eeeb] pt-3 text-[10px] text-[#aaa59d]">
            <span className="flex items-center gap-1"><MessageSquare size={10} />{contact.last_contacted_at ? `Last contact ${new Date(contact.last_contacted_at).toLocaleDateString()}` : 'No communication yet'}</span>
            <span>Services: {linkedServices.length ? linkedServices.slice(0, 2).map((item) => item.service?.name ?? services.find((service) => service.id === item.service_id)?.name ?? 'Service').join(', ') : 'none linked'}</span>
            <span>Open issues: 0</span>
            <span>{contact.internal_notes || contact.notes ? 'Has notes' : 'No notes'}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-1 border-t border-[#f0eeeb] pt-3 opacity-0 transition-opacity group-hover:opacity-100" onClick={(event) => event.stopPropagation()}>
        <button title="Notes" onClick={onNotes} className="flex h-7 items-center gap-1 rounded-[7px] border border-[#e4e2de] px-2 text-[10px] text-[#77736d] hover:bg-[#f4f2ef]"><StickyNote size={11} />Notes</button>
        <button title="Edit" onClick={onEdit} className="flex h-7 items-center gap-1 rounded-[7px] border border-[#e4e2de] px-2 text-[10px] text-[#77736d] hover:bg-[#f4f2ef]"><Pencil size={11} />Edit</button>
        <button title="Delete" onClick={onDelete} className="flex h-7 items-center gap-1 rounded-[7px] border border-[#f0c8c3] px-2 text-[10px] text-[#a33a30] hover:bg-[#fff7f6]"><Trash2 size={11} />Delete</button>
      </div>
    </motion.button>
  );
}

function ConversationHistory({ contact }: { contact: Contact }) {
  const [emails, setEmails] = useState<InboxEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!contact.email) {
      setLoading(false);
      return;
    }
    supabase.from('inbox').select('*').eq('sender email', contact.email).order('created_at', { ascending: false }).then(({ data, error: queryError }) => {
      if (queryError) setError(queryError.message);
      else setEmails((data as InboxEmail[]) ?? []);
      setLoading(false);
    });
  }, [contact.email]);
  if (!contact.email) return <EmptyState icon={Mail} title="No email history yet" description="Add an email address to connect this contact to inbox history." />;
  if (loading) return <LoadingState />;
  if (error) return <InlineError message={error} />;
  if (!emails.length) return <EmptyState icon={MessageSquare} title="No conversations yet" description={`Messages from ${contact.email} will appear here.`} />;
  return <div className="space-y-2">{emails.map((email) => <div key={email.Id} className="rounded-[10px] border border-[#ebe8e3] bg-white p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[12px] font-semibold text-[#35322e]">{email.subject?.trim() || '(No subject)'}</p>{email.body && <p className="mt-1 line-clamp-2 text-[11px] leading-[1.5] text-[#8e8981]">{email.body}</p>}</div><span className="flex-shrink-0 text-[10px] text-[#aaa59d]">{new Date(email.created_at).toLocaleDateString()}</span></div>{email.response && <p className="mt-2 text-[10px] font-medium text-[#5f6f52]">FlowPoint replied to this conversation</p>}</div>)}</div>;
}

function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return <div className="flex flex-col items-center justify-center rounded-[11px] border border-dashed border-[#d9d5ce] bg-[#fbfaf8] px-6 py-12 text-center"><Icon size={22} strokeWidth={1.5} className="text-[#aaa59d]" /><p className="mt-3 text-[13px] font-semibold text-[#4a4741]">{title}</p><p className="mt-1 max-w-[330px] text-[11px] leading-[1.6] text-[#97928a]">{description}</p></div>;
}

function LoadingState() {
  return <div className="flex items-center justify-center py-12"><RefreshCw size={18} className="animate-spin text-[#aaa59d]" /></div>;
}

function InlineError({ message }: { message: string }) {
  return <div className="flex items-start gap-2 rounded-[9px] border border-[#f0c8c3] bg-[#fff7f6] px-3 py-2.5 text-[11px] text-[#a33a30]"><AlertCircle size={13} className="mt-0.5 flex-shrink-0" />{message}</div>;
}

function RelationshipPanel({
  contact,
  relationships,
  relationshipHistory,
  properties,
  units,
  onAdd,
  onRemove,
}: {
  contact: Contact;
  relationships: ContactPropertyRelationship[];
  relationshipHistory: ContactPropertyRelationshipHistory[];
  properties: Property[];
  units: Unit[];
  onAdd: (data: Omit<ContactPropertyRelationship, 'id' | 'company_id' | 'property' | 'unit'>) => Promise<void>;
  onRemove: (relationship: ContactPropertyRelationship) => Promise<void>;
}) {
  const [draft, setDraft] = useState({ property_id: '', unit_id: '', relationship_type: 'tenant' as RelationshipType, start_date: '', end_date: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const linked = relationships.filter((item) => item.contact_id === contact.id);
  const historical = relationshipHistory.filter((item) => String(item.contact_id) === String(contact.id));
  const propertyUnits = units.filter((unit) => !draft.property_id || unit.property_id === draft.property_id);
  const add = async () => {
    if (!draft.property_id) return;
    setSaving(true);
    try {
      await onAdd({ contact_id: contact.id, property_id: draft.property_id, unit_id: draft.unit_id || null, relationship_type: draft.relationship_type, start_date: draft.start_date || null, end_date: draft.end_date || null, notes: draft.notes.trim() || null, ownership_percentage: null, ownership_scope: null });
      setDraft({ property_id: '', unit_id: '', relationship_type: 'tenant', start_date: '', end_date: '', notes: '' });
    } finally {
      setSaving(false);
    }
  };
  return <div className="space-y-4">
    <div className="rounded-[11px] border border-[#e9e6e1] bg-white p-4">
      <p className="text-[12px] font-semibold text-[#35322e]">Add a property relationship</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Property"><FlowPointSelect value={draft.property_id} onChange={(value) => setDraft((current) => ({ ...current, property_id: value, unit_id: '' }))} placeholder="Select property" options={properties.map((property) => ({ value: property.id, label: property.name, secondary: [property.city, property.address_line1].filter(Boolean).join(' · ') }))} /></Field>
        <Field label="Unit" hint="optional"><FlowPointSelect value={draft.unit_id} onChange={(value) => setDraft((current) => ({ ...current, unit_id: value }))} placeholder="Select unit" options={propertyUnits.map((unit) => ({ value: unit.id, label: unit.unit_number, secondary: unit.unit_type ?? undefined }))} emptyLabel={draft.property_id ? 'No units for this property' : 'Select a property first'} /></Field>
        <Field label="Relationship type"><FlowPointSelect value={draft.relationship_type} onChange={(value) => setDraft((current) => ({ ...current, relationship_type: value as RelationshipType }))} placeholder="Select relationship" options={RELATIONSHIP_TYPES.map((item) => ({ ...item }))} /></Field>
        <Field label="Start date" hint="optional"><input type="date" className={inputClass} value={draft.start_date} onChange={(event) => setDraft((current) => ({ ...current, start_date: event.target.value }))} /></Field>
        <Field label="End date" hint="optional"><input type="date" className={inputClass} value={draft.end_date} onChange={(event) => setDraft((current) => ({ ...current, end_date: event.target.value }))} /></Field>
        <Field label="Notes" hint="optional"><input className={inputClass} value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Lease or ownership context" /></Field>
      </div>
      <button onClick={add} disabled={!draft.property_id || saving} className="mt-3 flex h-9 items-center gap-2 rounded-[9px] bg-[#151412] px-3.5 text-[12px] font-semibold text-white hover:bg-[#312f2c] disabled:opacity-40">{saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}Add relationship</button>
    </div>
    {linked.length === 0 && historical.length === 0 ? <EmptyState icon={Home} title="No property relationships yet" description="Connect this person to the properties and units they work with." /> : <div className="space-y-2">{linked.map((relationship) => { const property = relationship.property ?? properties.find((item) => item.id === relationship.property_id); const unit = relationship.unit ?? units.find((item) => item.id === relationship.unit_id); const ownership = relationship.ownership_percentage !== null && relationship.ownership_percentage !== undefined ? `${relationship.ownership_percentage}% ownership` : relationship.ownership_scope; return <div key={String(relationship.id)} className="flex items-start justify-between gap-3 rounded-[11px] border border-[#e9e6e1] bg-white p-3"><div className="flex min-w-0 gap-3"><div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[9px] bg-[#f1eee9] text-[#706b62]"><Building2 size={15} /></div><div className="min-w-0"><p className="truncate text-[12px] font-semibold text-[#35322e]">{property?.name ?? 'Property unavailable'}</p><p className="mt-1 text-[10px] text-[#8e8981]">{unit ? `Unit ${unit.unit_number} · ` : ''}{relationshipTypeLabel(relationship.relationship_type)}</p>{ownership && <p className="mt-1 text-[10px] font-medium text-[#625e57]">{ownership}</p>}{(relationship.start_date || relationship.end_date) && <p className="mt-1 text-[10px] text-[#aaa59d]">{relationship.start_date ?? 'Open'} → {relationship.end_date ?? 'Current'}</p>}</div></div><button onClick={() => onRemove(relationship)} className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[7px] border border-[#f0c8c3] text-[#a33a30] hover:bg-[#fff7f6]"><Trash2 size={12} /></button></div>; })}</div>}
    {historical.length > 0 && <section className="mt-4"><p className="mb-2 text-[11px] font-semibold uppercase tracking-[.08em] text-[#9b968d]">Former property history</p><div className="space-y-2">{historical.map((item) => <div key={item.id} className="rounded-[11px] border border-[#eeeae5] bg-[#faf9f7] p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[12px] font-semibold text-[#625e57]">{item.property_name ?? 'Property unavailable'}</p><p className="mt-1 text-[10px] text-[#8e8981]">{item.unit_number ? `Unit ${item.unit_number} · ` : ''}{relationshipTypeLabel(item.relationship_type)}</p></div><span className="flex-shrink-0 text-[10px] text-[#aaa59d]">{new Date(item.archived_at).toLocaleDateString()}</span></div>{(item.start_date || item.end_date) && <p className="mt-2 text-[10px] text-[#9b968d]">{item.start_date ?? 'Open'} → {item.end_date ?? 'Ended'}</p>}{item.ownership_scope && <p className="mt-1 text-[10px] text-[#77736d]">{item.ownership_scope}</p>}</div>)}</div></section>}
  </div>;
}

function ContactProfile({
  contact,
  relationships,
  relationshipHistory,
  properties,
  units,
  serviceRelationships,
  services,
  onClose,
  onEdit,
  onAddRelationship,
  onRemoveRelationship,
  onSaveNotes,
}: {
  contact: Contact;
  relationships: ContactPropertyRelationship[];
  relationshipHistory: ContactPropertyRelationshipHistory[];
  properties: Property[];
  units: Unit[];
  serviceRelationships: ServiceContactRelationship[];
  services: Service[];
  onClose: () => void;
  onEdit: () => void;
  onAddRelationship: (data: Omit<ContactPropertyRelationship, 'id' | 'company_id' | 'property' | 'unit'>) => Promise<void>;
  onRemoveRelationship: (relationship: ContactPropertyRelationship) => Promise<void>;
  onSaveNotes: (notes: { notes: string | null; internal_notes: string | null }) => Promise<void>;
}) {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<'overview' | 'relationships' | 'services' | 'issues' | 'communication' | 'notes'>('overview');
  const [notes, setNotes] = useState(contact.notes ?? '');
  const [internalNotes, setInternalNotes] = useState(contact.internal_notes ?? '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [issues, setIssues] = useState<RequestRecord[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const tabs = [
    ['overview', 'Overview'],
    ['relationships', 'Relationships'],
    ['services', 'Services'],
    ['issues', 'Issues'],
    ['communication', 'Communication'],
    ['notes', 'Notes'],
  ] as const;
  const saveNotes = async () => {
    setSavingNotes(true);
    try { await onSaveNotes({ notes: notes.trim() || null, internal_notes: internalNotes.trim() || null }); } finally { setSavingNotes(false); }
  };
  useEffect(() => {
    if (tab !== 'issues') return;
    let active = true;
    setIssuesLoading(true);
    supabase.from('requests').select('*').eq('contact_id', contact.id).order('updated_at', { ascending: false })
      .then(({ data, error }) => {
        if (active && !error) setIssues((data as RequestRecord[]) ?? []);
        if (active) setIssuesLoading(false);
      });
    return () => { active = false; };
  }, [tab, contact.id]);
  return <Modal onClose={onClose} extraWide>
    <div className="flex items-start justify-between border-b border-[#ebe8e3] px-5 py-4"><div className="flex min-w-0 items-center gap-3"><Avatar name={contact.name} size={48} /><div className="min-w-0"><p className="truncate text-[16px] font-semibold text-[#151412]">{contact.name}</p><p className="mt-1 text-[11px] text-[#8b877f]">{contact.customer_id ?? 'Customer ID pending'} · {contactTypeLabel(contact.contact_type)}</p></div></div><div className="flex items-center gap-2"><button onClick={onEdit} className="flex h-8 items-center gap-1.5 rounded-[8px] border border-[#e4e2de] px-2.5 text-[11px] font-medium text-[#625e57] hover:bg-[#f0eeea]"><Pencil size={12} />Edit</button><button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full border border-[#e4e2de] text-[#817d76] hover:bg-[#f0eeea]"><X size={14} /></button></div></div>
    <div className="flex gap-1 overflow-x-auto border-b border-[#ebe8e3] px-5 pt-2">{tabs.map(([value, label]) => <button key={value} onClick={() => setTab(value)} className={`whitespace-nowrap border-b-2 px-2 pb-2.5 text-[11px] font-semibold transition-colors ${tab === value ? 'border-[#151412] text-[#151412]' : 'border-transparent text-[#9a958d] hover:text-[#4d4942]'}`}>{label}</button>)}</div>
    <div className="max-h-[calc(92vh-138px)] overflow-y-auto px-5 py-5">
      {tab === 'overview' && <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><div className="rounded-[11px] border border-[#e9e6e1] bg-white p-4"><p className="mb-3 text-[12px] font-semibold text-[#35322e]">Identity</p><Detail label="Contact type" value={contactTypeLabel(contact.contact_type)} /><Detail label="Status" value={contactStatusLabel(contact.status)} /><Detail label="Customer ID" value={contact.customer_id ?? 'Pending'} /><Detail label="Company" value={contact.company_name ?? contact.business_name} /></div><div className="rounded-[11px] border border-[#e9e6e1] bg-white p-4"><p className="mb-3 text-[12px] font-semibold text-[#35322e]">Communication</p><Detail label="Email" value={contact.email} /><Detail label="Phone" value={contact.phone} /><Detail label="Alternate phone" value={contact.alternate_phone} /><Detail label="Preferred channel" value={channelLabel(contact.preferred_channel)} /></div><div className="rounded-[11px] border border-[#e9e6e1] bg-white p-4 md:col-span-2"><p className="mb-3 text-[12px] font-semibold text-[#35322e]">Address and context</p><Detail label="Address" value={[contact.address, contact.city, contact.state, contact.zip_code, contact.country].filter(Boolean).join(', ')} /><Detail label="AI summary" value={contact.ai_summary} /><Detail label="Internal notes" value={contact.internal_notes ?? contact.notes} /></div></div>}
       {tab === 'relationships' && <RelationshipPanel contact={contact} relationships={relationships} relationshipHistory={relationshipHistory} properties={properties} units={units} onAdd={onAddRelationship} onRemove={onRemoveRelationship} />}
       {tab === 'services' && <ContactServices contact={contact} serviceRelationships={serviceRelationships} services={services} />}
       {tab === 'issues' && <div>
         {issuesLoading && <div className="flex items-center justify-center py-10 text-[11px] text-[#8e8981]"><Loader2 size={14} className="mr-2 animate-spin" />Loading requests…</div>}
         {!issuesLoading && issues.length === 0 && <EmptyState icon={AlertCircle} title="No requests or issues yet" description="Requests linked to this contact will appear here from the Requests / Issues workspace." />}
         {!issuesLoading && issues.length > 0 && <div className="space-y-2">{issues.map((issue) => <button key={issue.id} onClick={() => navigate('/requests')} className="w-full rounded-[11px] border border-[#e9e6e1] bg-white p-3 text-left transition-colors hover:bg-[#fcfbf9]"><div className="flex items-start justify-between gap-3"><p className="truncate text-[12px] font-semibold text-[#35322e]">{issue.title}</p><div className="flex flex-shrink-0 gap-1.5"><span className="rounded-full border border-[#e3dfd9] bg-[#f5f3f0] px-2 py-0.5 text-[10px] font-semibold text-[#77736d]">{requestStatusLabel(issue.status)}</span><span className="rounded-full border border-[#e3dfd9] bg-[#f5f3f0] px-2 py-0.5 text-[10px] font-semibold text-[#77736d]">{requestPriorityLabel(issue.priority)}</span></div></div><p className="mt-1 text-[10px] text-[#9b968d]">Updated {new Date(issue.updated_at).toLocaleDateString()} · {ageLabel(issue.created_at, issue.closed_at)}</p></button>)}</div>}
       </div>}
      {tab === 'communication' && <ConversationHistory contact={contact} />}
      {tab === 'notes' && <div className="max-w-[700px] space-y-4"><div><Field label="Internal notes" hint="private to the business"><textarea className={textAreaClass} rows={6} value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} placeholder="Private context for the team" /></Field></div><div><Field label="Legacy notes" hint="preserved from the existing contact record"><textarea className={textAreaClass} rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Existing notes" /></Field></div><button onClick={saveNotes} disabled={savingNotes} className="flex h-9 items-center gap-2 rounded-[9px] bg-[#151412] px-3.5 text-[12px] font-semibold text-white hover:bg-[#312f2c] disabled:opacity-50">{savingNotes && <Loader2 size={13} className="animate-spin" />}Save notes</button></div>}
    </div>
  </Modal>;
}

function ContactServices({ contact, serviceRelationships, services }: { contact: Contact; serviceRelationships: ServiceContactRelationship[]; services: Service[] }) {
  const linked = serviceRelationships.filter((item) => String(item.contact_id) === String(contact.id));
  if (!linked.length) return <EmptyState icon={BriefcaseIcon} title="No services linked" description="This contact does not have any service relationships yet. Add the relationship from the Services page." />;
  return <div className="space-y-2">{linked.map((relationship) => {
    const service = relationship.service ?? services.find((item) => item.id === relationship.service_id);
    return <div key={String(relationship.id)} className="rounded-[11px] border border-[#e9e6e1] bg-white p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[12px] font-semibold text-[#35322e]">{service?.name ?? 'Service unavailable'}</p><p className="mt-1 text-[10px] text-[#8e8981]">{service?.category ?? 'Category unavailable'}</p></div><span className="rounded-full border border-[#d2ead7] bg-[#f2faf3] px-2 py-0.5 text-[10px] font-semibold text-[#327443]">{relationship.relationship_status ?? 'Active'}</span></div>{relationship.notes && <p className="mt-2 text-[11px] leading-[1.5] text-[#77736d]">{relationship.notes}</p>}</div>;
  })}</div>;
}

function BriefcaseIcon(props: React.ComponentProps<typeof Archive>) {
  return <Archive {...props} />;
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return <div className="flex items-start justify-between gap-4 border-b border-[#f0eeeb] py-2 last:border-0"><span className="text-[10px] font-semibold uppercase tracking-[.06em] text-[#aaa59d]">{label}</span><span className="max-w-[68%] text-right text-[12px] text-[#4d4942]">{value || 'Not provided'}</span></div>;
}

function ConfirmDelete({ name, deleting, onCancel, onConfirm }: { name: string; deleting: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={deleting ? undefined : onCancel} className="absolute inset-0 bg-[#171511]/30 backdrop-blur-[2px]" /><motion.div initial={{ opacity: 0, y: 8, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="relative w-full max-w-[380px] rounded-[16px] border border-[#e4e2de] bg-[#fbfaf8] p-6 text-center shadow-[0_24px_80px_rgba(25,22,18,.18)]"><div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-[#f0cbc6] bg-[#fff3f1] text-[#b33d32]"><Trash2 size={17} /></div><h2 className="mt-4 text-[15px] font-semibold text-[#24211e]">Delete {name}?</h2><p className="mt-1 text-[12px] leading-[1.5] text-[#8f8980]">This removes the contact and its property relationships.</p><div className="mt-5 flex gap-2"><button onClick={onCancel} disabled={deleting} className="h-9 flex-1 rounded-[9px] border border-[#e4e2de] text-[12px] font-medium text-[#625e57] hover:bg-[#f0eeea] disabled:opacity-50">Cancel</button><button onClick={onConfirm} disabled={deleting} className="flex h-9 flex-1 items-center justify-center gap-2 rounded-[9px] bg-[#b33d32] text-[12px] font-semibold text-white hover:bg-[#96342b] disabled:opacity-50">{deleting && <Loader2 size={13} className="animate-spin" />}Delete</button></div></motion.div></div>;
}

export default function ContactsPage() {
  useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [relationships, setRelationships] = useState<ContactPropertyRelationship[]>([]);
  const [relationshipHistory, setRelationshipHistory] = useState<ContactPropertyRelationshipHistory[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceRelationships, setServiceRelationships] = useState<ServiceContactRelationship[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [relationshipError, setRelationshipError] = useState<string | null>(null);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [lastContactFilter, setLastContactFilter] = useState('');
  const [issuesFilter, setIssuesFilter] = useState('');
  const [formContact, setFormContact] = useState<Contact | null | undefined>(undefined);
  const [profileContact, setProfileContact] = useState<Contact | null>(null);
  const [notesContact, setNotesContact] = useState<Contact | null>(null);
  const [deleteContact, setDeleteContact] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [contactsResult, relationshipsResult, historyResult, propertiesResult, unitsResult, servicesResult, serviceRelationshipsResult] = await Promise.all([
      supabase.from('contacts').select('*').order('name'),
      supabase.from('contact_property_relationships').select('id, company_id, contact_id, property_id, unit_id, relationship_type, start_date, end_date, notes, ownership_percentage, ownership_scope, property:properties(id, name, address_line1, city), unit:units(id, unit_number, property_id)'),
      supabase.from('contact_property_relationship_history').select('*').order('archived_at', { ascending: false }),
      supabase.from('properties').select('*').order('name'),
      supabase.from('units').select('*').order('unit_number'),
      supabase.from('services').select('*').order('name'),
      supabase.from('contact_services').select('id, company_id, service_id, contact_id, relationship_status, notes, service:services(id, name, category, status)'),
    ]);
    if (contactsResult.error) setError(contactsResult.error.message);
    else setContacts((contactsResult.data as Contact[]) ?? []);
    if (relationshipsResult.error) {
      setRelationshipError(relationshipsResult.error.message);
      setRelationships([]);
    } else {
      setRelationshipError(null);
      setRelationships((relationshipsResult.data as unknown as ContactPropertyRelationship[]) ?? []);
    }
    setRelationshipHistory(historyResult.error ? [] : (historyResult.data as ContactPropertyRelationshipHistory[]) ?? []);
    if (!propertiesResult.error) setProperties((propertiesResult.data as Property[]) ?? []);
    if (!unitsResult.error) setUnits((unitsResult.data as Unit[]) ?? []);
    if (servicesResult.error) {
      setServiceError(servicesResult.error.message);
      setServices([]);
    } else {
      setServiceError(null);
      setServices((servicesResult.data as Service[]) ?? []);
    }
    if (serviceRelationshipsResult.error) {
      setServiceRelationships([]);
    } else {
      setServiceRelationships((serviceRelationshipsResult.data as unknown as ServiceContactRelationship[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const saveContact = async (draft: ContactDraft) => {
    const payload = { ...draft, customer_id: draft.customer_id || undefined };
    if (formContact) {
      const { data, error: saveError } = await supabase.from('contacts').update(payload).eq('id', formContact.id).select().single();
      if (saveError) throw new Error(saveError.message);
      const updated = data as Contact;
      setContacts((current) => current.map((item) => item.id === updated.id ? updated : item));
      setProfileContact((current) => current?.id === updated.id ? updated : current);
      setFeedback({ tone: 'success', message: 'Contact changes saved.' });
    } else {
      const { data, error: saveError } = await supabase.from('contacts').insert([payload]).select().single();
      if (saveError) throw new Error(saveError.message);
      setContacts((current) => [...current, data as Contact].sort((a, b) => a.name.localeCompare(b.name)));
      pushSingleNotification('contact_added', 'Contact added', `${draft.name} was added to contacts.`).catch(() => undefined);
      setFeedback({ tone: 'success', message: 'Contact added.' });
    }
  };

  const saveNotes = async (contact: Contact, notes: { notes: string | null; internal_notes: string | null }) => {
    const { data, error: saveError } = await supabase.from('contacts').update(notes).eq('id', contact.id).select().single();
    if (saveError) throw new Error(saveError.message);
    const updated = data as Contact;
    setContacts((current) => current.map((item) => item.id === updated.id ? updated : item));
    setProfileContact((current) => current?.id === updated.id ? updated : current);
    setNotesContact((current) => current?.id === updated.id ? updated : current);
    setFeedback({ tone: 'success', message: 'Notes saved.' });
  };

  const addRelationship = async (data: Omit<ContactPropertyRelationship, 'id' | 'company_id' | 'property' | 'unit'>) => {
      const { data: inserted, error: saveError } = await supabase.from('contact_property_relationships').insert([data]).select('id, company_id, contact_id, property_id, unit_id, relationship_type, start_date, end_date, notes, ownership_percentage, ownership_scope, property:properties(id, name, address_line1, city), unit:units(id, unit_number, property_id)').single();
    if (saveError) throw new Error(saveError.message);
    setRelationships((current) => [...current, inserted as unknown as ContactPropertyRelationship]);
    setFeedback({ tone: 'success', message: 'Property relationship added.' });
  };

  const removeRelationship = async (relationship: ContactPropertyRelationship) => {
    const { error: deleteError } = await supabase.from('contact_property_relationships').delete().eq('id', relationship.id);
    if (deleteError) throw new Error(deleteError.message);
    setRelationships((current) => current.filter((item) => item.id !== relationship.id));
    setFeedback({ tone: 'success', message: 'Property relationship removed.' });
  };

  const deleteSelectedContact = async () => {
    if (!deleteContact) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('contacts').delete().eq('id', deleteContact.id);
    if (deleteError) {
      setFeedback({ tone: 'error', message: deleteError.message });
      setDeleting(false);
      return;
    }
    setContacts((current) => current.filter((item) => item.id !== deleteContact.id));
    setRelationships((current) => current.filter((item) => item.contact_id !== deleteContact.id));
    setDeleteContact(null);
    setProfileContact(null);
    setDeleting(false);
    setFeedback({ tone: 'success', message: 'Contact deleted.' });
  };

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const now = Date.now();
    return contacts.filter((contact) => {
      const linked = relationships.filter((item) => item.contact_id === contact.id);
      const linkedPropertyIds = linked.map((item) => item.property_id);
      const linkedUnitIds = linked.map((item) => item.unit_id).filter(Boolean);
      const linkedPropertyNames = linked.map((item) => item.property?.name ?? properties.find((property) => property.id === item.property_id)?.name ?? '').join(' ');
       const linkedUnitNumbers = linked.map((item) => item.unit?.unit_number ?? units.find((unit) => unit.id === item.unit_id)?.unit_number ?? '').join(' ');
       const linkedServices = serviceRelationships.filter((item) => String(item.contact_id) === String(contact.id));
       const linkedServiceNames = linkedServices.map((item) => item.service?.name ?? services.find((service) => service.id === item.service_id)?.name ?? '').join(' ');
       const haystack = [contact.name, contact.email, contact.phone, contact.customer_id, contact.company_name, contact.business_name, linkedPropertyNames, linkedUnitNumbers, linkedServiceNames].filter(Boolean).join(' ').toLowerCase();
      const lastContact = contact.last_contacted_at ? new Date(contact.last_contacted_at).getTime() : null;
      const matchesLastContact = !lastContactFilter || (lastContactFilter === 'never' ? !lastContact : lastContactFilter === 'older' ? Boolean(lastContact && now - lastContact > 30 * 86400000) : Boolean(lastContact && now - lastContact <= Number(lastContactFilter) * 86400000));
      return (!needle || haystack.includes(needle)) &&
        (!typeFilter || contact.contact_type === typeFilter) &&
        (!statusFilter || contact.status === statusFilter) &&
        (!propertyFilter || linkedPropertyIds.includes(propertyFilter)) &&
        (!unitFilter || linkedUnitIds.includes(unitFilter)) &&
         (!serviceFilter || (serviceFilter === 'none' ? linkedServices.length === 0 : linkedServices.some((item) => item.service_id === serviceFilter))) &&
        (!issuesFilter || issuesFilter === 'none') &&
        matchesLastContact;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [contacts, relationships, properties, units, services, serviceRelationships, search, typeFilter, statusFilter, propertyFilter, unitFilter, serviceFilter, lastContactFilter, issuesFilter]);

  const clearFilters = () => { setSearch(''); setTypeFilter(''); setStatusFilter(''); setPropertyFilter(''); setUnitFilter(''); setServiceFilter(''); setLastContactFilter(''); setIssuesFilter(''); };

  return <AppLayout><div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8f7f5]">
    <header className="flex flex-shrink-0 items-center justify-between border-b border-[#e9e6e1] bg-[#fbfaf8] px-5 py-4 sm:px-8"><div><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#a19c93]">People and relationships</p><h1 className="mt-1 text-[20px] font-semibold tracking-[-.02em] text-[#151412]">Contacts</h1><p className="mt-1 max-w-[720px] text-[12px] text-[#77736d]">Manage the people your company communicates with and the properties, units, services, requests, and conversations connected to them.</p></div><div className="flex items-center gap-2"><NotificationBell /><button onClick={() => setFormContact(null)} className="flex h-9 items-center gap-2 rounded-[9px] bg-[#151412] px-3.5 text-[12px] font-semibold text-white shadow-[0_2px_5px_rgba(0,0,0,.12)] hover:bg-[#312f2c]"><Plus size={14} />Add contact</button></div></header>
    <div className="min-h-0 flex-1 overflow-y-auto"><div className="mx-auto max-w-[1440px] px-5 py-6 sm:px-8 sm:py-8">
      {feedback && <div className={`mb-5 flex items-center justify-between rounded-[10px] border px-3 py-2.5 text-[12px] ${feedback.tone === 'success' ? 'border-[#d2ead7] bg-[#f2faf3] text-[#327443]' : 'border-[#f0c8c3] bg-[#fff7f6] text-[#a33a30]'}`}><span className="flex items-center gap-2">{feedback.tone === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}{feedback.message}</span><button onClick={() => setFeedback(null)}><X size={14} /></button></div>}
       {(relationshipError || serviceError) && <div className="mb-5 flex items-start gap-2 rounded-[10px] border border-[#f1dfb8] bg-[#fffaf0] px-3 py-2.5 text-[11px] text-[#8d671b]"><AlertCircle size={13} className="mt-0.5 flex-shrink-0" /><span>Some relationship data needs the supplied Supabase migration before it can be loaded. {relationshipError ?? serviceError}</span></div>}
       <div className="rounded-[13px] border border-[#e9e6e1] bg-white p-3.5">
         <div className="flex items-center gap-2">
           <label className="relative min-w-0 flex-1"><Search size={12} className="pointer-events-none absolute left-[10px] top-1/2 -translate-y-1/2 text-[#aaa59d]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, company, property, or unit" className="h-[30px] w-full rounded-[8px] border border-[#e5e2dd] bg-[#faf9f7] pl-7 pr-7 text-[12px] text-[#151412] outline-none placeholder:text-[#b3b0aa] focus:border-[#cfcac2] focus:bg-white" />{search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-[#aaa59d] hover:text-[#151412]"><X size={11} /></button>}</label>
           <PageFilterMenu testId="button-contact-filters" activeCount={[typeFilter, statusFilter, propertyFilter, unitFilter, serviceFilter, lastContactFilter, issuesFilter].filter(Boolean).length} onReset={() => { setTypeFilter(''); setStatusFilter(''); setPropertyFilter(''); setUnitFilter(''); setServiceFilter(''); setLastContactFilter(''); setIssuesFilter(''); }}>
             <FlowPointSelect value={typeFilter} onChange={setTypeFilter} placeholder="All contact types" options={CONTACT_TYPES.map((item) => ({ ...item }))} />
             <FlowPointSelect value={statusFilter} onChange={setStatusFilter} placeholder="All statuses" options={CONTACT_STATUSES.map((item) => ({ ...item }))} />
             <FlowPointSelect value={propertyFilter} onChange={setPropertyFilter} placeholder="All properties" options={properties.map((property) => ({ value: property.id, label: property.name }))} />
             <FlowPointSelect value={unitFilter} onChange={setUnitFilter} placeholder="All units" options={units.map((unit) => ({ value: unit.id, label: unit.unit_number, secondary: properties.find((property) => property.id === unit.property_id)?.name }))} />
             <FlowPointSelect value={serviceFilter} onChange={setServiceFilter} placeholder="All services" options={[{ value: 'none', label: 'No services linked' }, ...services.map((service) => ({ value: service.id, label: service.name, secondary: service.category }))]} />
             <FlowPointSelect value={lastContactFilter} onChange={setLastContactFilter} placeholder="Last communication" options={[{ value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: 'older', label: 'Older than 30 days' }, { value: 'never', label: 'Never contacted' }]} />
             <FlowPointSelect value={issuesFilter} onChange={setIssuesFilter} placeholder="Open issues" options={[{ value: 'none', label: 'No open issues' }]} />
           </PageFilterMenu>
           <button type="button" onClick={loadData} disabled={loading} aria-label="Refresh contacts" className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-[#e5e2dd] bg-[#faf9f7] text-[#89847c] hover:border-[#cfcac2] hover:text-[#151412] disabled:opacity-50"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /></button>
         </div>
       </div>
      {loading && <LoadingState />}
      {!loading && error && <div className="mt-5"><InlineError message={error} /></div>}
       {!loading && !error && filtered.length === 0 && <div className="mt-5"><EmptyState icon={Users2} title={search || typeFilter || statusFilter || propertyFilter || unitFilter || serviceFilter || lastContactFilter || issuesFilter ? 'No matching contacts' : 'No contacts yet'} description={search || typeFilter || statusFilter || propertyFilter || unitFilter || serviceFilter || lastContactFilter || issuesFilter ? 'Try a different search or reset the filters.' : 'Add the first contact to give your team a shared identity and relationship record.'} /></div>}
        {!loading && !error && filtered.length > 0 && <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"><AnimatePresence mode="popLayout">{filtered.map((contact) => <ContactCard key={contact.id} contact={contact} relationships={relationships} properties={properties} units={units} serviceRelationships={serviceRelationships} services={services} onOpen={() => setProfileContact(contact)} onEdit={() => setFormContact(contact)} onDelete={() => setDeleteContact(contact)} onNotes={() => setNotesContact(contact)} />)}</AnimatePresence></div>}
    </div></div>
    <AnimatePresence>{formContact !== undefined && <ContactForm contact={formContact} onSave={saveContact} onClose={() => setFormContact(undefined)} />}</AnimatePresence>
     <AnimatePresence>{profileContact && <ContactProfile contact={profileContact} relationships={relationships} relationshipHistory={relationshipHistory} properties={properties} units={units} serviceRelationships={serviceRelationships} services={services} onClose={() => setProfileContact(null)} onEdit={() => setFormContact(profileContact)} onAddRelationship={addRelationship} onRemoveRelationship={removeRelationship} onSaveNotes={(notes) => saveNotes(profileContact, notes)} />}</AnimatePresence>
     <AnimatePresence>{notesContact && <ContactProfile contact={notesContact} relationships={relationships} relationshipHistory={relationshipHistory} properties={properties} units={units} serviceRelationships={serviceRelationships} services={services} onClose={() => setNotesContact(null)} onEdit={() => setFormContact(notesContact)} onAddRelationship={addRelationship} onRemoveRelationship={removeRelationship} onSaveNotes={(notes) => saveNotes(notesContact, notes)} />}</AnimatePresence>
    <AnimatePresence>{deleteContact && <ConfirmDelete name={deleteContact.name} deleting={deleting} onCancel={() => setDeleteContact(null)} onConfirm={deleteSelectedContact} />}</AnimatePresence>
  </div></AppLayout>;
}