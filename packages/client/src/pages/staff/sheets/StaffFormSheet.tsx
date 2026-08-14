import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { NextOfKinInfo, StaffRecord, parseNextOfKin } from '../blocks/StaffList';

type RoleOption = { id: string | number; name: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (values: Record<string, any>) => void;
  initialValues?: StaffRecord | null;
  saving?: boolean;
  roleOptions: RoleOption[];
};

const MARITAL_STATUS_OPTIONS = ['Single', 'Married', 'Divorced', 'Widowed', 'Separated'];

const StaffFormSheet = ({ open, onOpenChange, initialValues, onSave, saving, roleOptions }: Props) => {
  const isEdit = Boolean(initialValues?.id);

  const [name, setName] = useState('');
  const [roleName, setRoleName] = useState('');
  const [staffNumber, setStaffNumber] = useState('');
  const [ninNumber, setNinNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [title, setTitle] = useState('');
  const [contractStart, setContractStart] = useState('');
  const [contractEnd, setContractEnd] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [bank, setBank] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [tin, setTin] = useState('');
  const [nssf, setNssf] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [nextOfKin, setNextOfKin] = useState<NextOfKinInfo>({});
  const [profilePicture, setProfilePicture] = useState('');
  const [signature, setSignature] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(initialValues?.name || '');
    setRoleName(initialValues?.role_name || '');
    setStaffNumber(initialValues?.staff_number || '');
    setNinNumber(initialValues?.nin_number || '');
    setDateOfBirth(initialValues?.date_of_birth?.slice(0, 10) || '');
    setTitle(initialValues?.title || '');
    setContractStart(initialValues?.contract_start?.slice(0, 10) || '');
    setContractEnd(initialValues?.contract_end?.slice(0, 10) || '');
    setTelephone(initialValues?.telephone || '');
    setEmail(initialValues?.email || '');
    setBank(initialValues?.bank || '');
    setBankAccount(initialValues?.bank_account || '');
    setTin(initialValues?.tin || '');
    setNssf(initialValues?.nssf || '');
    setMaritalStatus(initialValues?.marital_status || '');
    setNextOfKin(parseNextOfKin(initialValues?.next_of_kin));
    setProfilePicture(initialValues?.profile_picture || '');
    setSignature(initialValues?.signature || '');
  }, [open, initialValues]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSave) {
      onSave({
        id: initialValues?.id || null,
        user_id: initialValues?.user_id || null,
        name,
        role_name: roleName,
        staff_number: staffNumber,
        nin_number: ninNumber,
        date_of_birth: dateOfBirth,
        title,
        contract_start: contractStart,
        contract_end: contractEnd,
        telephone,
        email,
        bank,
        bank_account: bankAccount,
        tin,
        nssf,
        marital_status: maritalStatus,
        next_of_kin: JSON.stringify(nextOfKin),
        profile_picture: profilePicture,
        signature,
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[900px] h-full flex flex-col p-0">
        <div className="p-6 border-b bg-slate-50/50">
          <SheetHeader>
            <SheetTitle>{isEdit ? 'Edit Staff' : 'New Staff'}</SheetTitle>
            <SheetDescription>
              {isEdit
                ? 'Update this staff member\'s details.'
                : 'A user account will be created automatically with a default password.'}
            </SheetDescription>
          </SheetHeader>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-y-auto p-6 space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800 pb-1 border-b">Personal Information</h3>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="label-text font-medium">Full Name</label>
                <input
                  className="input input-bordered w-full"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label-text font-medium">Date of Birth</label>
                <input
                  type="date"
                  className="input input-bordered w-full"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label-text font-medium">National ID Number (NIN)</label>
                <input
                  className="input input-bordered w-full"
                  value={ninNumber}
                  onChange={(e) => setNinNumber(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label-text font-medium">Marital Status</label>
                <select
                  className="select select-bordered w-full"
                  value={maritalStatus}
                  onChange={(e) => setMaritalStatus(e.target.value)}
                  required
                >
                  <option value="">Select status</option>
                  {MARITAL_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800 pb-1 border-b">Role & Employment</h3>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="label-text font-medium">Staff Number</label>
                <input
                  className="input input-bordered w-full"
                  value={staffNumber}
                  onChange={(e) => setStaffNumber(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label-text font-medium">Role</label>
                <select
                  className="select select-bordered w-full"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  required
                >
                  <option value="">Select role</option>
                  {roleOptions.map((role) => (
                    <option key={role.id} value={role.name}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-text font-medium">Job Title</label>
                <input
                  className="input input-bordered w-full"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div />
              <div>
                <label className="label-text font-medium">Contract Start</label>
                <input
                  type="date"
                  className="input input-bordered w-full"
                  value={contractStart}
                  onChange={(e) => setContractStart(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label-text font-medium">Contract End</label>
                <input
                  type="date"
                  className="input input-bordered w-full"
                  value={contractEnd}
                  onChange={(e) => setContractEnd(e.target.value)}
                  required
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800 pb-1 border-b">Contact Information</h3>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="label-text font-medium">Telephone</label>
                <input
                  type="tel"
                  className="input input-bordered w-full"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label-text font-medium">Email</label>
                <input
                  type="email"
                  className="input input-bordered w-full"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isEdit}
                />
                {isEdit && (
                  <p className="text-xs text-slate-400 mt-1">Email is linked to the login account and can't be changed here.</p>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800 pb-1 border-b">Financial Details</h3>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="label-text font-medium">Bank</label>
                <input
                  className="input input-bordered w-full"
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label-text font-medium">Bank Account Number</label>
                <input
                  className="input input-bordered w-full"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label-text font-medium">TIN</label>
                <input
                  className="input input-bordered w-full"
                  value={tin}
                  onChange={(e) => setTin(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label-text font-medium">NSSF Number</label>
                <input
                  className="input input-bordered w-full"
                  value={nssf}
                  onChange={(e) => setNssf(e.target.value)}
                  required
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800 pb-1 border-b">Next of Kin</h3>
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <label className="label-text font-medium">Full Name</label>
                <input
                  className="input input-bordered w-full"
                  value={nextOfKin.name || ''}
                  onChange={(e) => setNextOfKin((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="label-text font-medium">Relationship</label>
                <input
                  className="input input-bordered w-full"
                  value={nextOfKin.relationship || ''}
                  onChange={(e) => setNextOfKin((prev) => ({ ...prev, relationship: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="label-text font-medium">Phone</label>
                <input
                  type="tel"
                  className="input input-bordered w-full"
                  value={nextOfKin.phone || ''}
                  onChange={(e) => setNextOfKin((prev) => ({ ...prev, phone: e.target.value }))}
                  required
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800 pb-1 border-b">Attachments</h3>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="label-text font-medium">Profile Picture (file name)</label>
                <input
                  className="input input-bordered w-full"
                  value={profilePicture}
                  onChange={(e) => setProfilePicture(e.target.value)}
                  placeholder="e.g. jane-doe.jpg"
                  required
                />
              </div>
              <div>
                <label className="label-text font-medium">Signature (file name)</label>
                <input
                  className="input input-bordered w-full"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="e.g. jane-doe-signature.png"
                  required
                />
              </div>
            </div>
          </section>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => onOpenChange(false)} className="btn btn-ghost">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary px-8" disabled={saving}>
              {saving ? 'Saving...' : isEdit ? 'Update' : 'Create Staff'}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export { StaffFormSheet };
