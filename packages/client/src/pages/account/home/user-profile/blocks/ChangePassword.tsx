import { FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { KeenIcon } from '@/components';
import { useAuthContext } from '@/auth';
import { toFriendlyErrorMessage } from '@/utils';

const ChangePassword = () => {
  const { changeMyPassword } = useAuthContext();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setSaving(true);
    try {
      await changeMyPassword(password, confirmPassword);
      toast.success('Password changed successfully');
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error(toFriendlyErrorMessage(error, 'Unable to change your password. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card min-w-full">
      <div className="card-header">
        <h3 className="card-title">Change Password</h3>
      </div>
      <form onSubmit={handleSubmit} className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">New Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              className="input w-full pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <KeenIcon icon={showPassword ? 'eye-slash' : 'eye'} />
            </button>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Confirm Password</label>
          <input
            type={showPassword ? 'text' : 'password'}
            className="input w-full"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Change Password'}
          </button>
        </div>
      </form>
    </div>
  );
};

export { ChangePassword };
