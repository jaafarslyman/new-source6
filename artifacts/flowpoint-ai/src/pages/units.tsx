import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle, Building2, Check, ChevronRight, DoorOpen, Filter, Loader2,
  MapPin, Pencil, Plus, RefreshCw, Search, Trash2, Wrench, X,
} from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import FlowPointSelect from '@/components/FlowPointSelect';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { propertyAddress, type Property } from '@/lib/propertiesTypes';
import {
  blankUnit, formatDate, formatMoney, unitStatusLabel, unitTypeLabel,
  UNIT_STATUSES, UNIT_TYPES, type Unit, type UnitDraft,
} from '@/lib/unitsTypes';
import { ageLabel, requestPriorityLabel, requestStatusLabel, type RequestRecord } from '@/lib/requestsTypes';

const inputClass = 'w-full h-[39px] rounded-[9px] border border-[#e4e2de] bg-white px-[11px] text-[13px] text-[#151412] outline-none placeholder:text-[#b3b0aa] focus:border-[#151412] focus:ring-2 focus:ring-[#151412]/8 transition-all';
const textAreaClass = 'w-full rounded-[9px] border border-[#e4e2de] bg-white px-[11px] py-[9px] text-[13px] leading-[1.5] text-[#151412] outline-none placeholder:text-[#b3b0aa] focus:border-[#151412] focus:ring-2 focus:ring-[#151412]/8 transition-all resize-none';

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="block"><span className="mb-[5px] block text-[10px] font-semibold uppercase tracking-[.08em] text-[#77736d]">{label}{hint && <span className="ml-1 normal-case font-normal tracking-normal text-[#aaa59d]">{hint}</span>}</span>{children}</label>;
}

function FormError({ message }: { message?: string }) {
  return message ? <p className="mt-1 flex items-center gap-1 text-[11px] text-[#b33d32]"><AlertCircle size={11} />{message}</p> : null;
}

function Modal({ children, onClose, wide = false }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5"><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-[#171511]/30 backdrop-blur-[2px]" /><motion.div initial={{ opacity: 0, y: 10, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .98 }} className={`relative max-h-[94vh] w-full overflow-hidden rounded-[16px] border border-[#e4e2de] bg-[#fbfaf8] shadow-[0_24px_80px_rgba(25,22,18,.18)] ${wide ? 'max-w-[820px]' : 'max-w-[520px]'}`} onClick={(event) => event.stopPropagation()}>{children}</motion.div></div>;
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

function UnitForm({ unit, properties, onSave, onClose }: {
  unit: Unit | null;
  properties: Property[];
  onSave: (draft: UnitDraft) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<UnitDraft>(() => unit ? unitDraftFromUnit(unit) : blankUnit);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof UnitDraft, value: string | number | null) => setForm((current) => ({ ...current, [key]: value }));
  const propertyOptions = properties.map((property) => ({ value: property.id, label: property.name, secondary: propertyAddress(property) || 'Address unavailable' }));

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!form.unit_number.trim()) next.unit_number = 'Unit number or name is required';
    if (!form.property_id) next.property_id = 'Select a property';
    if (form.floor !== null && (Number.isNaN(form.floor) || form.floor < 0)) next.floor = 'Enter zero or more';
    if (form.bedrooms !== null && (Number.isNaN(form.bedrooms) || form.bedrooms < 0)) next.bedrooms = 'Enter zero or more';
    if (form.bathrooms !== null && (Number.isNaN(form.bathrooms) || form.bathrooms < 0)) next.bathrooms = 'Enter zero or more';
    if (form.square_footage !== null && (Number.isNaN(form.square_footage) || form.square_footage < 0)) next.square_footage = 'Enter zero or more';
    if (form.monthly_rent !== null && (Number.isNaN(form.monthly_rent) || form.monthly_rent < 0)) next.monthly_rent = 'Enter zero or more';
    if (form.security_deposit !== null && (Number.isNaN(form.security_deposit) || form.security_deposit < 0)) next.security_deposit = 'Enter zero or more';
    if (form.rent_due_day !== null && (Number.isNaN(form.rent_due_day) || form.rent_due_day < 1 || form.rent_due_day > 31)) next.rent_due_day = 'Use a day from 1 to 31';
    if (form.lease_start_date && form.lease_end_date && form.lease_end_date < form.lease_start_date) next.lease_end_date = 'End date must be on or after the start date';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave({
        ...form,
        unit_number: form.unit_number.trim(),
        description: form.description?.trim() || null,
        amenities: form.amenities?.trim() || null,
        utilities_information: form.utilities_information?.trim() || null,
        parking_information: form.parking_information?.trim() || null,
        access_information: form.access_information?.trim() || null,
        rules: form.rules?.trim() || null,
        notes: form.notes?.trim() || null,
        lease_start_date: form.lease_start_date || null,
        lease_end_date: form.lease_end_date || null,
      });
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save unit');
      setSaving(false);
    }
  };

  return <Modal onClose={onClose} wide>
    <div className="flex items-center justify-between border-b border-[#ebe8e3] px-5 py-4">
      <div><p className="text-[15px] font-semibold text-[#151412]">{unit ? 'Edit unit' : 'Add unit'}</p><p className="mt-1 text-[11px] text-[#8b877f]">{unit ? 'Keep the unit record current for your operations team.' : 'Add the details your team needs to manage this unit.'}</p></div>
      <button data-testid="button-close-unit-form" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full border border-[#e4e2de] text-[#817d76] hover:bg-[#f0eeea] hover:text-[#151412]"><X size={14} /></button>
    </div>
    <div className="max-h-[calc(94vh-72px)] overflow-y-auto px-5 py-5">
      <section><div className="mb-3"><p className="text-[12px] font-semibold text-[#35322e]">Basic information</p><p className="mt-1 text-[11px] text-[#9c978e]">Identify the unit and connect it to a property.</p></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Unit number / name"><input data-testid="input-unit-number" autoFocus className={inputClass} value={form.unit_number} onChange={(event) => set('unit_number', event.target.value)} placeholder="e.g. 2B or Rear Cottage" /><FormError message={errors.unit_number} /></Field>
        <Field label="Property"><FlowPointSelect testId="select-unit-property" value={form.property_id} onChange={(value) => set('property_id', value)} placeholder={properties.length ? 'Select a property' : 'No properties available'} options={propertyOptions} disabled={!properties.length} emptyLabel="No properties available. Add a property first." /><FormError message={errors.property_id} /></Field>
        <Field label="Unit type"><FlowPointSelect testId="select-unit-type" value={form.unit_type ?? ''} onChange={(value) => set('unit_type', value)} placeholder="Select a type" options={UNIT_TYPES.map((type) => ({ value: type.value, label: type.label }))} /></Field>
        <Field label="Floor" hint="optional"><input data-testid="input-unit-floor" type="number" min="0" step="1" className={inputClass} value={form.floor ?? ''} onChange={(event) => set('floor', event.target.value === '' ? null : Number(event.target.value))} placeholder="e.g. 2" /><FormError message={errors.floor} /></Field>
        <Field label="Bedrooms" hint="optional"><input data-testid="input-unit-bedrooms" type="number" min="0" step="0.5" className={inputClass} value={form.bedrooms ?? ''} onChange={(event) => set('bedrooms', event.target.value === '' ? null : Number(event.target.value))} placeholder="e.g. 2" /><FormError message={errors.bedrooms} /></Field>
        <Field label="Bathrooms" hint="optional"><input data-testid="input-unit-bathrooms" type="number" min="0" step="0.5" className={inputClass} value={form.bathrooms ?? ''} onChange={(event) => set('bathrooms', event.target.value === '' ? null : Number(event.target.value))} placeholder="e.g. 1.5" /><FormError message={errors.bathrooms} /></Field>
        <Field label="Square footage" hint="optional"><input data-testid="input-unit-square-footage" type="number" min="0" step="1" className={inputClass} value={form.square_footage ?? ''} onChange={(event) => set('square_footage', event.target.value === '' ? null : Number(event.target.value))} placeholder="e.g. 850" /><FormError message={errors.square_footage} /></Field>
        <div className="sm:col-span-2"><Field label="Description" hint="optional"><textarea data-testid="input-unit-description" className={textAreaClass} rows={3} value={form.description ?? ''} onChange={(event) => set('description', event.target.value)} placeholder="A short description for your team" /></Field></div>
      </div></section>
      <section className="mt-6 border-t border-[#ebe8e3] pt-5"><div className="mb-3"><p className="text-[12px] font-semibold text-[#35322e]">Rental information</p><p className="mt-1 text-[11px] text-[#9c978e]">Track rent, deposits, and the current lease window.</p></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Monthly rent" hint="optional"><input data-testid="input-unit-monthly-rent" type="number" min="0" step="0.01" className={inputClass} value={form.monthly_rent ?? ''} onChange={(event) => set('monthly_rent', event.target.value === '' ? null : Number(event.target.value))} placeholder="0.00" /><FormError message={errors.monthly_rent} /></Field>
        <Field label="Security deposit" hint="optional"><input data-testid="input-unit-security-deposit" type="number" min="0" step="0.01" className={inputClass} value={form.security_deposit ?? ''} onChange={(event) => set('security_deposit', event.target.value === '' ? null : Number(event.target.value))} placeholder="0.00" /><FormError message={errors.security_deposit} /></Field>
        <Field label="Rent due day" hint="optional"><input data-testid="input-unit-rent-due-day" type="number" min="1" max="31" step="1" className={inputClass} value={form.rent_due_day ?? ''} onChange={(event) => set('rent_due_day', event.target.value === '' ? null : Number(event.target.value))} placeholder="1" /><FormError message={errors.rent_due_day} /></Field>
        <div />
        <Field label="Lease start" hint="optional"><input data-testid="input-unit-lease-start" type="date" className={inputClass} value={form.lease_start_date ?? ''} onChange={(event) => set('lease_start_date', event.target.value || null)} /></Field>
        <Field label="Lease end" hint="optional"><input data-testid="input-unit-lease-end" type="date" className={inputClass} value={form.lease_end_date ?? ''} onChange={(event) => set('lease_end_date', event.target.value || null)} /><FormError message={errors.lease_end_date} /></Field>
      </div></section>
      <section className="mt-6 border-t border-[#ebe8e3] pt-5"><div className="mb-3"><p className="text-[12px] font-semibold text-[#35322e]">Occupancy</p><p className="mt-1 text-[11px] text-[#9c978e]">Set the unit's current operating status.</p></div><Field label="Status"><FlowPointSelect testId="select-unit-status" value={form.status ?? ''} onChange={(value) => set('status', value)} placeholder="Select a status" options={UNIT_STATUSES.map((status) => ({ value: status.value, label: status.label }))} /></Field></section>
      <section className="mt-6 border-t border-[#ebe8e3] pt-5"><div className="mb-3"><p className="text-[12px] font-semibold text-[#35322e]">Unit information</p><p className="mt-1 text-[11px] text-[#9c978e]">Keep operational context with the unit record.</p></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Amenities" hint="optional"><textarea data-testid="input-unit-amenities" className={textAreaClass} rows={3} value={form.amenities ?? ''} onChange={(event) => set('amenities', event.target.value)} placeholder="Pool, balcony, laundry..." /></Field>
        <Field label="Utilities" hint="optional"><textarea data-testid="input-unit-utilities" className={textAreaClass} rows={3} value={form.utilities_information ?? ''} onChange={(event) => set('utilities_information', event.target.value)} placeholder="Included utilities or providers" /></Field>
        <Field label="Parking information" hint="optional"><textarea data-testid="input-unit-parking" className={textAreaClass} rows={3} value={form.parking_information ?? ''} onChange={(event) => set('parking_information', event.target.value)} placeholder="Space, permit, or restrictions" /></Field>
        <Field label="Access information" hint="optional"><textarea data-testid="input-unit-access" className={textAreaClass} rows={3} value={form.access_information ?? ''} onChange={(event) => set('access_information', event.target.value)} placeholder="Keys, codes, or entry instructions" /></Field>
        <Field label="Rules" hint="optional"><textarea data-testid="input-unit-rules" className={textAreaClass} rows={3} value={form.rules ?? ''} onChange={(event) => set('rules', event.target.value)} placeholder="Unit-specific guidelines" /></Field>
        <Field label="Notes" hint="optional"><textarea data-testid="input-unit-notes" className={textAreaClass} rows={3} value={form.notes ?? ''} onChange={(event) => set('notes', event.target.value)} placeholder="Private notes for your team" /></Field>
      </div></section>
      {!properties.length && <div className="mt-5 flex items-start gap-2 rounded-[9px] border border-[#eadfbd] bg-[#fffaf0] px-3 py-2.5 text-[12px] text-[#8e6e2b]"><Building2 size={14} className="mt-0.5 flex-shrink-0" />No properties available. Add a property first.</div>}
      {saveError && <div className="mt-5 flex items-start gap-2 rounded-[9px] border border-[#f0c8c3] bg-[#fff7f6] px-3 py-2.5 text-[12px] text-[#a33a30]"><AlertCircle size={14} className="mt-0.5 flex-shrink-0" />{saveError}</div>}
      <div className="mt-5 flex justify-end gap-2 border-t border-[#ebe8e3] pt-4"><button data-testid="button-cancel-unit" onClick={onClose} disabled={saving} className="h-9 rounded-[9px] border border-[#e4e2de] px-4 text-[12px] font-medium text-[#625e57] hover:bg-[#f0eeea] disabled:opacity-50">Cancel</button><button data-testid="button-save-unit" onClick={submit} disabled={saving || !properties.length} className="flex h-9 items-center gap-2 rounded-[9px] bg-[#151412] px-4 text-[12px] font-semibold text-white hover:bg-[#312f2c] disabled:opacity-50">{saving && <Loader2 size={13} className="animate-spin" />}{unit ? 'Save changes' : 'Add unit'}</button></div>
    </div>
  </Modal>;
}

function StatusPill({ status }: { status: string | null }) {
  const tone = status === 'occupied' ? 'bg-[#edf7ef] text-[#327443] border-[#d6ecd9]' : status === 'vacant' ? 'bg-[#eef5fb] text-[#39709c] border-[#d3e4f2]' : status === 'maintenance' ? 'bg-[#fff7e6] text-[#a36810] border-[#f1dfb8]' : 'bg-[#f1f0ee] text-[#77736d] border-[#e1dfda]';
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tone}`}>{unitStatusLabel(status)}</span>;
}

function ConfirmDelete({ unit, deleting, onCancel, onConfirm }: { unit: Unit; deleting: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <Modal onClose={deleting ? () => {} : onCancel}><div className="p-6 text-center"><div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-[#f0cbc6] bg-[#fff3f1] text-[#b33d32]"><Trash2 size={17} /></div><h2 className="mt-4 text-[15px] font-semibold text-[#24211e]">Delete unit {unit.unit_number}?</h2><p className="mt-1 text-[12px] leading-[1.5] text-[#8f8980]">This unit record will be permanently removed. This action cannot be undone.</p><div className="mt-5 flex gap-2"><button data-testid="button-cancel-delete-unit" onClick={onCancel} disabled={deleting} className="h-9 flex-1 rounded-[9px] border border-[#e4e2de] text-[12px] font-medium text-[#625e57] hover:bg-[#f0eeea] disabled:opacity-50">Cancel</button><button data-testid="button-confirm-delete-unit" onClick={onConfirm} disabled={deleting} className="flex h-9 flex-1 items-center justify-center gap-2 rounded-[9px] bg-[#b33d32] text-[12px] font-semibold text-white hover:bg-[#96342b] disabled:opacity-50">{deleting && <Loader2 size={13} className="animate-spin" />}Delete unit</button></div></div></Modal>;
}

function UnitDetails({ unit, property, onClose, onEdit, onDelete }: { unit: Unit; property?: Property; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
  const Info = ({ label, value }: { label: string; value: string | number | null | undefined }) => <div className="border-b border-[#f0eeeb] py-3 last:border-0"><p className="text-[10px] font-semibold uppercase tracking-[.08em] text-[#9b968d]">{label}</p><p className="mt-1 whitespace-pre-wrap text-[13px] leading-[1.5] text-[#37342f]">{value === null || value === undefined || value === '' ? <span className="italic text-[#b1aca4]">Unavailable</span> : value}</p></div>;
  const [issues, setIssues] = useState<RequestRecord[]>([]);
  useEffect(() => { let active = true; supabase.from('requests').select('*').eq('unit_id', unit.id).order('updated_at', { ascending: false }).then(({ data }) => { if (active) setIssues((data as RequestRecord[]) ?? []); }); return () => { active = false; }; }, [unit.id]);
  return <Modal onClose={onClose} wide><div className="flex items-center justify-between border-b border-[#ebe8e3] px-5 py-4 sm:px-6"><div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[11px] bg-[#eeebe5] text-[#706b62]"><DoorOpen size={19} strokeWidth={1.6} /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 data-testid="heading-unit-detail" className="text-[17px] font-semibold text-[#151412]">Unit {unit.unit_number}</h2><StatusPill status={unit.status} /></div><p className="mt-1 flex items-center gap-1.5 truncate text-[11px] text-[#858078]"><Building2 size={11} />{property?.name ?? 'Property unavailable'}</p></div></div><div className="ml-3 flex flex-shrink-0 items-center gap-2"><button data-testid="button-edit-unit" onClick={onEdit} className="flex h-8 items-center gap-1.5 rounded-[8px] border border-[#e0ddd7] bg-white px-3 text-[11px] font-semibold text-[#4d4942] hover:bg-[#f2f0ec]"><Pencil size={12} />Edit</button><button data-testid="button-delete-unit" onClick={onDelete} className="flex h-8 items-center gap-1.5 rounded-[8px] border border-[#efd0cc] bg-white px-3 text-[11px] font-semibold text-[#a33a30] hover:bg-[#fff2f0]"><Trash2 size={12} />Delete</button><button data-testid="button-close-unit-detail" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e4e2de] text-[#817d76] hover:bg-[#f0eeea]"><X size={14} /></button></div></div><div className="max-h-[calc(94vh-72px)] overflow-y-auto px-5 py-5 sm:px-6"><div className="grid gap-4 lg:grid-cols-2"><section className="rounded-[14px] border border-[#e9e6e1] bg-white p-5"><h3 className="text-[13px] font-semibold text-[#302d28]">Overview</h3><div className="mt-2 grid gap-x-7 sm:grid-cols-2"><Info label="Unit number" value={unit.unit_number} /><Info label="Property" value={property?.name} /><Info label="Address" value={property ? propertyAddress(property) : null} /><Info label="Unit type" value={unitTypeLabel(unit.unit_type)} /><Info label="Description" value={unit.description} /><Info label="Floor" value={unit.floor} /><Info label="Bedrooms" value={unit.bedrooms} /><Info label="Bathrooms" value={unit.bathrooms} /><Info label="Square footage" value={unit.square_footage} /></div></section><section className="rounded-[14px] border border-[#e9e6e1] bg-white p-5"><h3 className="text-[13px] font-semibold text-[#302d28]">Rental</h3><div className="mt-2"><Info label="Monthly rent" value={formatMoney(unit.monthly_rent)} /><Info label="Security deposit" value={formatMoney(unit.security_deposit)} /><Info label="Rent due day" value={unit.rent_due_day ? `Day ${unit.rent_due_day}` : null} /><Info label="Lease start" value={formatDate(unit.lease_start_date)} /><Info label="Lease end" value={formatDate(unit.lease_end_date)} /></div></section></div><section className="mt-4 rounded-[14px] border border-[#e9e6e1] bg-white p-5"><h3 className="text-[13px] font-semibold text-[#302d28]">Unit information</h3><div className="mt-2 grid gap-x-7 sm:grid-cols-2"><Info label="Amenities" value={unit.amenities} /><Info label="Utilities" value={unit.utilities_information} /><Info label="Parking information" value={unit.parking_information} /><Info label="Access information" value={unit.access_information} /><Info label="Rules" value={unit.rules} /><Info label="Notes" value={unit.notes} /></div></section><section className="mt-4 rounded-[14px] border border-[#e9e6e1] bg-white p-5"><div className="mb-3 flex items-center justify-between"><div><h3 className="text-[13px] font-semibold text-[#302d28]">Requests / Issues</h3><p className="mt-1 text-[11px] text-[#9b968d]">Operational work connected to this unit.</p></div><Wrench size={16} className="text-[#aaa59d]" /></div>{issues.length === 0 ? <p className="rounded-[10px] border border-dashed border-[#d9d5ce] px-4 py-6 text-center text-[11px] text-[#97928a]">No requests linked to this unit.</p> : <div className="space-y-2">{issues.map((issue) => <div key={issue.id} className="rounded-[10px] border border-[#f0eeeb] p-3"><div className="flex items-start justify-between gap-3"><p className="truncate text-[12px] font-semibold text-[#35322e]">{issue.title}</p><div className="flex gap-1.5"><span className="rounded-full border border-[#e3dfd9] bg-[#f5f3f0] px-2 py-0.5 text-[10px] font-semibold text-[#77736d]">{requestStatusLabel(issue.status)}</span><span className="rounded-full border border-[#e3dfd9] bg-[#f5f3f0] px-2 py-0.5 text-[10px] font-semibold text-[#77736d]">{requestPriorityLabel(issue.priority)}</span></div></div><p className="mt-1 text-[10px] text-[#9b968d]">{ageLabel(issue.created_at, issue.closed_at)}</p></div>)}</div>}</section></div></Modal>;
}

export default function UnitsPage() {
  useAuth();
  const [units, setUnits] = useState<Unit[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const propertyById = useMemo(() => new Map(properties.map((property) => [property.id, property])), [properties]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [unitsResult, propertiesResult] = await Promise.all([
      supabase.from('units').select('*').order('unit_number', { ascending: true }),
      supabase.from('properties').select('*').order('name', { ascending: true }),
    ]);
    if (unitsResult.error || propertiesResult.error) setError(unitsResult.error?.message ?? propertiesResult.error?.message ?? 'Unable to load units');
    else {
      setUnits((unitsResult.data as Unit[]) ?? []);
      setProperties((propertiesResult.data as Property[]) ?? []);
    }
    setLoading(false);
  }, []);
  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return units.filter((unit) => {
      const property = propertyById.get(unit.property_id);
      const searchable = [unit.unit_number, property?.name, propertyAddress(property as Property), unit.description].filter(Boolean).join(' ').toLowerCase();
      return (!needle || searchable.includes(needle)) && (!propertyFilter || unit.property_id === propertyFilter) && (!statusFilter || unit.status === statusFilter) && (!typeFilter || unit.unit_type === typeFilter);
    });
  }, [units, propertyById, search, propertyFilter, statusFilter, typeFilter]);

  const saveUnit = async (draft: UnitDraft) => {
    if (selectedUnit) {
      const { data, error: updateError } = await supabase.from('units').update(draft).eq('id', selectedUnit.id).select().single();
      if (updateError) throw new Error(updateError.message);
      const updated = data as Unit;
      setUnits((current) => current.map((unit) => unit.id === updated.id ? updated : unit).sort((a, b) => a.unit_number.localeCompare(b.unit_number)));
      setSelectedUnit(updated);
      setFeedback({ tone: 'success', message: 'Unit changes saved.' });
    } else {
      const { data, error: insertError } = await supabase.from('units').insert([draft]).select().single();
      if (insertError) throw new Error(insertError.message);
      setUnits((current) => [...current, data as Unit].sort((a, b) => a.unit_number.localeCompare(b.unit_number)));
      setFeedback({ tone: 'success', message: 'Unit added.' });
    }
  };

  const deleteUnit = async () => {
    if (!selectedUnit) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('units').delete().eq('id', selectedUnit.id);
    if (deleteError) {
      setFeedback({ tone: 'error', message: deleteError.message });
      setDeleting(false);
      setDeleteOpen(false);
      return;
    }
    setUnits((current) => current.filter((unit) => unit.id !== selectedUnit.id));
    setSelectedUnit(null);
    setDeleteOpen(false);
    setDeleting(false);
    setFeedback({ tone: 'success', message: 'Unit deleted.' });
  };

  return <AppLayout><div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8f7f5]">
    <header className="flex flex-shrink-0 items-center justify-between border-b border-[#e9e6e1] bg-[#fbfaf8] px-5 py-4 sm:px-8"><div><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#a19c93]">Operations</p><h1 data-testid="heading-units" className="mt-1 text-[20px] font-semibold tracking-[-.02em] text-[#151412]">Units</h1></div><button data-testid="button-add-unit" onClick={() => { setSelectedUnit(null); setFormOpen(true); }} className="flex h-9 items-center gap-2 rounded-[9px] bg-[#151412] px-3.5 text-[12px] font-semibold text-white shadow-[0_2px_5px_rgba(0,0,0,.12)] hover:bg-[#312f2c]"><Plus size={14} />Add unit</button></header>
    <div className="min-h-0 flex-1 overflow-y-auto"><div className="mx-auto max-w-[1240px] px-5 py-6 sm:px-8 sm:py-8">
      {feedback && <div data-testid={`feedback-units-${feedback.tone}`} className={`mb-5 flex items-center justify-between rounded-[10px] border px-3 py-2.5 text-[12px] ${feedback.tone === 'success' ? 'border-[#d2ead7] bg-[#f2faf3] text-[#327443]' : 'border-[#f0c8c3] bg-[#fff7f6] text-[#a33a30]'}`}><span className="flex items-center gap-2">{feedback.tone === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}{feedback.message}</span><button data-testid="button-dismiss-units-feedback" onClick={() => setFeedback(null)}><X size={14} /></button></div>}
      <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><p className="text-[13px] text-[#706c64]">Manage the individual spaces inside the properties your team looks after.</p><p className="mt-1 text-[11px] text-[#a19c93]">{units.length} {units.length === 1 ? 'unit' : 'units'} in your portfolio</p></div><div className="flex flex-col gap-2 sm:flex-row"><label className="relative block min-w-[230px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a8a39b]" /><input data-testid="input-unit-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search unit or property" className={`${inputClass} pl-9`} /></label><div className="flex gap-2"><div className="min-w-[150px]"><FlowPointSelect testId="select-unit-property-filter" value={propertyFilter} onChange={setPropertyFilter} placeholder="All properties" options={properties.map((property) => ({ value: property.id, label: property.name }))} /></div><div className="min-w-[128px]"><FlowPointSelect testId="select-unit-status-filter" value={statusFilter} onChange={setStatusFilter} placeholder="All statuses" options={UNIT_STATUSES.map((status) => ({ value: status.value, label: status.label }))} /></div><div className="min-w-[128px]"><FlowPointSelect testId="select-unit-type-filter" value={typeFilter} onChange={setTypeFilter} placeholder="All types" options={UNIT_TYPES.map((type) => ({ value: type.value, label: type.label }))} /></div></div></div></div>
      {loading && <div data-testid="loading-units" className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="h-[190px] animate-pulse rounded-[13px] border border-[#eeeae5] bg-[#f0eeeb]" />)}</div>}
      {!loading && error && <div data-testid="error-units" className="flex flex-col items-center justify-center rounded-[14px] border border-[#f0c8c3] bg-[#fff9f8] px-6 py-16 text-center"><AlertCircle size={24} className="text-[#b33d32]" /><p className="mt-3 text-[13px] font-semibold text-[#4d2c28]">Units could not be loaded</p><p className="mt-1 max-w-[480px] text-[12px] text-[#9d716b]">{error}</p><button data-testid="button-retry-units" onClick={loadData} className="mt-4 flex h-8 items-center gap-2 rounded-[8px] border border-[#e6c2bd] px-3 text-[12px] font-medium text-[#8e3a31] hover:bg-[#fff0ee]"><RefreshCw size={12} />Try again</button></div>}
      {!loading && !error && properties.length === 0 && <div data-testid="empty-unit-properties" className="mb-4 flex flex-col items-center justify-center rounded-[14px] border border-dashed border-[#d9d5ce] bg-[#fbfaf8] px-6 py-14 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#f0ede8] text-[#777269]"><Building2 size={23} strokeWidth={1.5} /></div><p className="mt-4 text-[14px] font-semibold text-[#34312c]">No properties available</p><p className="mt-1 max-w-[380px] text-[12px] leading-[1.6] text-[#97928a]">Add a property first before creating a unit. Units stay connected to a property's UUID.</p></div>}
      {!loading && !error && properties.length > 0 && units.length === 0 && <div data-testid="empty-units" className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-[#d9d5ce] bg-[#fbfaf8] px-6 py-20 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#f0ede8] text-[#777269]"><DoorOpen size={23} strokeWidth={1.5} /></div><p className="mt-4 text-[14px] font-semibold text-[#34312c]">No units yet</p><p className="mt-1 max-w-[360px] text-[12px] leading-[1.6] text-[#97928a]">Add the first unit to start tracking spaces, leases, and occupancy.</p><button data-testid="button-empty-add-unit" onClick={() => { setSelectedUnit(null); setFormOpen(true); }} className="mt-5 flex h-9 items-center gap-2 rounded-[9px] bg-[#151412] px-3.5 text-[12px] font-semibold text-white hover:bg-[#312f2c]"><Plus size={14} />Add unit</button></div>}
      {!loading && !error && units.length > 0 && filtered.length === 0 && <div data-testid="empty-filtered-units" className="rounded-[14px] border border-[#e9e6e1] bg-white px-6 py-16 text-center"><Filter size={20} className="mx-auto text-[#bbb6ae]" /><p className="mt-3 text-[13px] font-semibold text-[#4a4741]">No matching units</p><p className="mt-1 text-[12px] text-[#99948b]">Try a different search or clear one of the filters.</p><button data-testid="button-clear-unit-filters" onClick={() => { setSearch(''); setPropertyFilter(''); setStatusFilter(''); setTypeFilter(''); }} className="mt-4 text-[12px] font-semibold text-[#4a4741] underline underline-offset-2">Clear filters</button></div>}
      {!loading && !error && filtered.length > 0 && <div data-testid="list-units" className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"><AnimatePresence mode="popLayout">{filtered.map((unit) => { const property = propertyById.get(unit.property_id); return <motion.button layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} key={unit.id} data-testid={`card-unit-${unit.id}`} onClick={() => setSelectedUnit(unit)} className="group w-full rounded-[13px] border border-[#e9e6e1] bg-white p-4 text-left transition-all hover:-translate-y-[1px] hover:border-[#d2cec7] hover:shadow-[0_6px_22px_rgba(31,28,23,.06)]"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-[#f1eee9] text-[#706b62]"><DoorOpen size={17} strokeWidth={1.7} /></div><div className="min-w-0"><p className="truncate text-[13px] font-semibold text-[#171512]">Unit {unit.unit_number}</p><p className="mt-1 flex items-center gap-1 truncate text-[11px] text-[#97928a]"><Building2 size={11} />{property?.name ?? 'Property unavailable'}</p><p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-[#aaa59d]"><MapPin size={10} />{property ? propertyAddress(property) || 'Address unavailable' : 'Address unavailable'}</p></div></div><ChevronRight size={15} className="mt-1 flex-shrink-0 text-[#bbb6ae] transition-transform group-hover:translate-x-0.5" /></div><div className="mt-4 border-t border-[#f0eeeb] pt-3"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-[11px] text-[#77736d]">{unitTypeLabel(unit.unit_type)}</span><span className="h-1 w-1 rounded-full bg-[#d2cec7]" /><span className="text-[11px] text-[#77736d]">{formatMoney(unit.monthly_rent) ?? 'Rent unavailable'}</span></div><StatusPill status={unit.status} /></div><div className="mt-3 grid grid-cols-3 gap-2 text-[10px]"><div><p className="text-[#aaa59d]">Tenant(s)</p><p className="mt-0.5 italic text-[#9b968d]">Unavailable</p></div><div><p className="text-[#aaa59d]">Due day</p><p className="mt-0.5 text-[#77736d]">{unit.rent_due_day ? `${unit.rent_due_day}th` : <span className="italic text-[#9b968d]">Unavailable</span>}</p></div><div><p className="text-[#aaa59d]">Open issues</p><p className="mt-0.5 italic text-[#9b968d]">Unavailable</p></div></div></div></motion.button>; })}</AnimatePresence></div>}
    </div></div>
    <AnimatePresence>{formOpen && <UnitForm unit={selectedUnit} properties={properties} onSave={saveUnit} onClose={() => setFormOpen(false)} />}</AnimatePresence>
    {selectedUnit && !formOpen && !deleteOpen && <UnitDetails unit={selectedUnit} property={propertyById.get(selectedUnit.property_id)} onClose={() => setSelectedUnit(null)} onEdit={() => setFormOpen(true)} onDelete={() => setDeleteOpen(true)} />}
    <AnimatePresence>{deleteOpen && selectedUnit && <ConfirmDelete unit={selectedUnit} deleting={deleting} onCancel={() => setDeleteOpen(false)} onConfirm={deleteUnit} />}</AnimatePresence>
  </div></AppLayout>;
}