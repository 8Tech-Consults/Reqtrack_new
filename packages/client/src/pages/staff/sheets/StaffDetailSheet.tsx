import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { User, Briefcase, Phone, Banknote, Users, Paperclip } from 'lucide-react';
import { URL_2 } from '@/config/urls';
import { StaffRecord, formatDate, parseNextOfKin } from '../blocks/StaffList';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detailRow?: StaffRecord | null;
};

const Field = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
    <p className="text-xs text-slate-500">{label}</p>
    <p className="font-medium text-slate-900 mt-0.5">{value || '—'}</p>
  </div>
);

const FileFieldView = ({ label, filename }: { label: string; filename?: string | null }) => (
  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
    <p className="text-xs text-slate-500 mb-1.5">{label}</p>
    {filename ? (
      <a
        href={`${URL_2}/staff/${filename}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 group"
      >
        <img
          src={`${URL_2}/staff/${filename}`}
          alt={label}
          className="h-12 w-12 rounded object-cover border border-slate-200"
        />
        <span className="text-sm text-blue-600 group-hover:underline">View full size</span>
      </a>
    ) : (
      <p className="font-medium text-slate-900">—</p>
    )}
  </div>
);

const StaffDetailSheet = ({ open, onOpenChange, detailRow }: Props) => {
  if (!detailRow) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-4xl h-full flex flex-col p-0">
          <div className="p-6 flex items-center justify-center h-full">
            <p className="text-slate-500">No data available</p>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const nextOfKin = parseNextOfKin(detailRow.next_of_kin);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-4xl h-full flex flex-col p-0">
        <div className="p-6 border-b bg-slate-50/50">
          <SheetHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <SheetTitle className="text-xl font-bold text-slate-900">{detailRow.name}</SheetTitle>
                <SheetDescription className="mt-0.5">{detailRow.staff_number}</SheetDescription>
              </div>
              <span className="badge badge-outline border-blue-200 bg-blue-50 text-blue-700">
                {detailRow.role_name}
              </span>
            </div>
          </SheetHeader>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <section className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b">
              <div className="p-1.5 bg-blue-50 rounded text-blue-600">
                <User size={15} />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">Personal Information</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <Field label="Full Name" value={detailRow.name} />
              <Field label="Date of Birth" value={formatDate(detailRow.date_of_birth)} />
              <Field label="National ID Number" value={detailRow.nin_number} />
              <Field label="Marital Status" value={detailRow.marital_status} />
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b">
              <div className="p-1.5 bg-blue-50 rounded text-blue-600">
                <Briefcase size={15} />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">Role & Employment</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <Field label="Staff Number" value={detailRow.staff_number} />
              <Field label="Role" value={detailRow.role_name} />
              <Field label="Job Title" value={detailRow.title} />
              <Field
                label="Contract Period"
                value={`${formatDate(detailRow.contract_start)} – ${formatDate(detailRow.contract_end)}`}
              />
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b">
              <div className="p-1.5 bg-blue-50 rounded text-blue-600">
                <Phone size={15} />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">Contact Information</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <Field label="Telephone" value={detailRow.telephone} />
              <Field label="Email" value={detailRow.email} />
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b">
              <div className="p-1.5 bg-blue-50 rounded text-blue-600">
                <Banknote size={15} />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">Financial Details</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <Field label="Bank" value={detailRow.bank} />
              <Field label="Bank Account Number" value={detailRow.bank_account} />
              <Field label="TIN" value={detailRow.tin} />
              <Field label="NSSF Number" value={detailRow.nssf} />
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b">
              <div className="p-1.5 bg-blue-50 rounded text-blue-600">
                <Users size={15} />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">Next of Kin</h3>
            </div>
            <div className="grid sm:grid-cols-3 gap-3 text-sm">
              <Field label="Full Name" value={nextOfKin.name} />
              <Field label="Relationship" value={nextOfKin.relationship} />
              <Field label="Phone" value={nextOfKin.phone} />
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b">
              <div className="p-1.5 bg-blue-50 rounded text-blue-600">
                <Paperclip size={15} />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">Attachments</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <FileFieldView label="Profile Picture" filename={detailRow.profile_picture} />
              <FileFieldView label="Signature" filename={detailRow.signature} />
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export { StaffDetailSheet };
