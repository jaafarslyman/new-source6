import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Building2, FileText, MapPin, MessageSquare, Pencil, ShieldAlert, Trash2,
  UserRound, Users, Wrench, X, Zap,
} from 'lucide-react';
import {
  propertyAddress, propertyStatusLabel, propertyTypeLabel, type Property,
} from '@/lib/propertiesTypes';
import type { Contact, ContactPropertyRelationship } from '@/lib/contactsTypes';
import { supabase } from '@/lib/supabase';
import { ageLabel, requestPriorityLabel, requestStatusLabel, type RequestRecord } from '@/lib/requestsTypes';

function StatusPill({ status }: { status: string | null }) {
  const tone = status === 'active'
    ? 'bg-[#edf7ef] text-[#327443] border-[#d6ecd9]'
    : status === 'inactive'
      ? 'bg-[#fff7e6] text-[#a36810] border-[#f1dfb8]'
      : 'bg-[#f1f0ee] text-[#77736d] border-[#e1dfda]';
  return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${tone}`}>{propertyStatusLabel(status)}</span>;
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="border-b border-[#f0eeeb] py-3 last:border-0">
      <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-[#9b968d]">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-[13px] leading-[1.5] text-[#37342f]">
        {value === null || value === undefined || value === '' ? <span className="italic text-[#b1aca4]">Unavailable</span> : value}
      </p>
    </div>
  );
}

function FutureSection({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[12px] border border-dashed border-[#dedad3] bg-[#faf9f7] p-4">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[9px] bg-[#efede8] text-[#858078]"><Icon size={15} strokeWidth={1.7} /></div>
      <div><p className="text-[12px] font-semibold text-[#4b4741]">{title}</p><p className="mt-1 text-[11px] leading-[1.5] text-[#9b968d]">{description}</p><span className="mt-2 inline-flex rounded-full border border-[#e3dfd9] bg-white px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[.06em] text-[#aaa59d]">Not connected</span></div>
    </div>
  );
}

function PropertyIssues({ propertyId }: { propertyId: string }) {
  const [issues, setIssues] = useState<RequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    supabase.from('requests').select('*').eq('property_id', propertyId).order('updated_at', { ascending: false }).then(({ data }) => {
      if (active) { setIssues((data as RequestRecord[]) ?? []); setLoading(false); }
    });
    return () => { active = false; };
  }, [propertyId]);
  return <section className="mt-4 rounded-[14px] border border-[#e9e6e1] bg-white p-5">
    <div className="mb-3 flex items-center justify-between"><div><h3 className="text-[13px] font-semibold text-[#302d28]">Requests / Issues</h3><p className="mt-1 text-[11px] text-[#9a958d]">Operational work connected to this property.</p></div><ShieldAlert size={16} className="text-[#aaa59d]" /></div>
    {loading ? <p className="text-[11px] text-[#9b968d]">Loading requests…</p> : issues.length === 0 ? <p className="rounded-[10px] border border-dashed border-[#d9d5ce] px-4 py-6 text-center text-[11px] text-[#97928a]">No requests linked to this property.</p> : <div className="space-y-2">{issues.map((issue) => <div key={issue.id} className="rounded-[10px] border border-[#f0eeeb] p-3"><div className="flex items-start justify-between gap-3"><p className="truncate text-[12px] font-semibold text-[#35322e]">{issue.title}</p><div className="flex gap-1.5"><span className="rounded-full border border-[#e3dfd9] bg-[#f5f3f0] px-2 py-0.5 text-[10px] font-semibold text-[#77736d]">{requestStatusLabel(issue.status)}</span><span className="rounded-full border border-[#e3dfd9] bg-[#f5f3f0] px-2 py-0.5 text-[10px] font-semibold text-[#77736d]">{requestPriorityLabel(issue.priority)}</span></div></div><p className="mt-1 text-[10px] text-[#9b968d]">{ageLabel(issue.created_at, issue.closed_at)}</p></div>)}</div>}
  </section>;
}

function PropertyOwners({ property, contacts, ownerships }: { property: Property; contacts: Contact[]; ownerships: ContactPropertyRelationship[] }) {
  const linked = ownerships.filter((relationship) => relationship.property_id === property.id);
  return <section className="mt-4 rounded-[14px] border border-[#e9e6e1] bg-white p-5">
    <div className="mb-3 flex items-center justify-between"><div><h3 className="text-[13px] font-semibold text-[#302d28]">Owners</h3><p className="mt-1 text-[11px] text-[#9a958d]">Contacts who own this property.</p></div><Users size={16} className="text-[#aaa59d]" /></div>
    {linked.length === 0 ? <p className="rounded-[10px] border border-dashed border-[#d9d5ce] px-4 py-6 text-center text-[11px] text-[#97928a]">No owners linked to this property.</p> : <div className="space-y-2">{linked.map((relationship) => {
      const contact = contacts.find((item) => item.id === relationship.contact_id);
      const ownership = relationship.ownership_percentage !== null && relationship.ownership_percentage !== undefined
        ? `${relationship.ownership_percentage}% ownership`
        : relationship.ownership_scope || 'Ownership details unavailable';
      return <div key={relationship.id} className="flex items-center justify-between gap-3 rounded-[10px] border border-[#f0eeeb] px-3 py-2.5"><div className="flex min-w-0 items-center gap-2.5"><div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#f1eee9] text-[#706b62]"><UserRound size={14} /></div><div className="min-w-0"><p className="truncate text-[12px] font-semibold text-[#35322e]">{contact?.name ?? 'Contact unavailable'}</p><p className="mt-0.5 truncate text-[10px] text-[#9b968d]">{contact?.email ?? contact?.phone ?? 'No contact details'}</p></div></div><span className="max-w-[45%] text-right text-[10px] font-semibold text-[#625e57]">{ownership}</span></div>;
    })}</div>}
  </section>;
}

interface PropertyProfileModalProps {
  property: Property;
  contacts: Contact[];
  ownerships: ContactPropertyRelationship[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function PropertyProfileModal({ property, contacts, ownerships, onClose, onEdit, onDelete }: PropertyProfileModalProps) {
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-[#171511]/30 backdrop-blur-[2px]" />
        <motion.div
          initial={{ opacity: 0, y: 12, scale: .98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: .98 }}
          className="relative flex max-h-[94vh] w-full max-w-[1080px] flex-col overflow-hidden rounded-[16px] border border-[#e4e2de] bg-[#fbfaf8] shadow-[0_24px_80px_rgba(25,22,18,.18)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="property-profile-title"
        >
          <header className="flex flex-shrink-0 items-center justify-between border-b border-[#ebe8e3] px-5 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[11px] bg-[#eeebe5] text-[#706b62]"><Building2 size={19} strokeWidth={1.6} /></div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h2 id="property-profile-title" className="truncate text-[17px] font-semibold tracking-[-.02em] text-[#151412]">{property.name}</h2><StatusPill status={property.status} /></div>
                <p className="mt-1 flex items-center gap-1.5 truncate text-[11px] text-[#858078]"><MapPin size={11} />{propertyAddress(property) || 'Address unavailable'}</p>
              </div>
            </div>
            <div className="ml-3 flex flex-shrink-0 items-center gap-2">
              <button data-testid="button-edit-property-profile" onClick={onEdit} className="flex h-8 items-center gap-1.5 rounded-[8px] border border-[#e0ddd7] bg-white px-3 text-[11px] font-semibold text-[#4d4942] hover:bg-[#f2f0ec]"><Pencil size={12} />Edit</button>
              <button data-testid="button-delete-property-profile" onClick={onDelete} className="flex h-8 items-center gap-1.5 rounded-[8px] border border-[#efd0cc] bg-white px-3 text-[11px] font-semibold text-[#b33d32] hover:bg-[#fff2f0]"><Trash2 size={12} />Delete</button>
              <button data-testid="button-close-property-profile" onClick={onClose} aria-label="Close property profile" className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e4e2de] text-[#817d76] hover:bg-[#f0eeea] hover:text-[#151412]"><X size={14} /></button>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
              <section className="rounded-[14px] border border-[#e9e6e1] bg-white p-5">
                <div className="mb-3 flex items-center justify-between"><div><h3 className="text-[13px] font-semibold text-[#302d28]">Overview</h3><p className="mt-1 text-[11px] text-[#9a958d]">The essentials your team needs at a glance.</p></div><Building2 size={16} className="text-[#aaa59d]" /></div>
                <div className="grid gap-x-7 sm:grid-cols-2"><InfoRow label="Property type" value={propertyTypeLabel(property.property_type)} /><InfoRow label="Units" value={property.units_count} /><InfoRow label="Address line 1" value={property.address_line1} /><InfoRow label="Address line 2" value={property.address_line2} /><InfoRow label="City" value={property.city} /><InfoRow label="State / region" value={property.state} /><InfoRow label="Postal code" value={property.postal_code} /><InfoRow label="Country" value={property.country} /></div>
                <div className="mt-3 border-t border-[#f0eeeb] pt-1"><InfoRow label="Description" value={property.description} /></div>
              </section>
              <section className="rounded-[14px] border border-[#e9e6e1] bg-white p-5">
                <div className="mb-3 flex items-center justify-between"><div><h3 className="text-[13px] font-semibold text-[#302d28]">Units</h3><p className="mt-1 text-[11px] text-[#9a958d]">Unit records will connect here.</p></div><Zap size={16} className="text-[#aaa59d]" /></div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="flex items-center justify-between rounded-[9px] bg-[#faf9f7] px-3 py-2.5"><span className="text-[11px] text-[#77736d]">Total units</span><span className="text-[11px] font-medium text-[#37342f]">{property.units_count ?? <span className="italic text-[#aaa59d]">Unavailable</span>}</span></div>
                  <div className="flex items-center justify-between rounded-[9px] bg-[#faf9f7] px-3 py-2.5"><span className="text-[11px] text-[#77736d]">Occupied</span><span className="text-[11px] italic text-[#aaa59d]">Unavailable</span></div>
                  <div className="flex items-center justify-between rounded-[9px] bg-[#faf9f7] px-3 py-2.5"><span className="text-[11px] text-[#77736d]">Active issues</span><span className="text-[11px] italic text-[#aaa59d]">Unavailable</span></div>
                </div>
              </section>
            </div>
            <section className="mt-4 rounded-[14px] border border-[#e9e6e1] bg-white p-5">
              <div className="mb-4"><h3 className="text-[13px] font-semibold text-[#302d28]">Notes</h3><p className="mt-1 text-[11px] text-[#9a958d]">Practical information for the people working this property.</p></div>
              <div className="grid gap-x-7 sm:grid-cols-2"><InfoRow label="Amenities" value={property.amenities} /><InfoRow label="Property rules" value={property.property_rules} /><InfoRow label="Parking information" value={property.parking_information} /><InfoRow label="Access information" value={property.access_information} /><InfoRow label="Utilities information" value={property.utilities_information} /><InfoRow label="Emergency information" value={property.emergency_information} /><div className="sm:col-span-2"><InfoRow label="Internal notes" value={property.notes} /></div></div>
            </section>
             <PropertyOwners property={property} contacts={contacts} ownerships={ownerships} />
            <PropertyIssues propertyId={property.id} />
             <section className="mt-4"><div className="mb-3"><h3 className="text-[13px] font-semibold text-[#302d28]">Property workspace</h3><p className="mt-1 text-[11px] text-[#9a958d]">Connected records will appear here as they become available.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><FutureSection icon={Users} title="Tenants" description="Residents and tenants connected to this property." /><FutureSection icon={Users} title="Staff" description="Team members assigned to this property." /><FutureSection icon={Wrench} title="Services" description="Recurring services and provider schedules." /><FutureSection icon={FileText} title="Documents" description="Leases, inspections, and property files." /><FutureSection icon={MessageSquare} title="Communication" description="Property-related communication history." /></div></section>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}