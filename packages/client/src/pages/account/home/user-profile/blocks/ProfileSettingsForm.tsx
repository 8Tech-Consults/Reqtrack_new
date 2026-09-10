import { FormEvent, useEffect, useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { toast } from 'sonner';
import { useAuthContext } from '@/auth';
import { CREATE_USER } from '@/gql/mutations';
import { toAbsoluteUrl, toFriendlyErrorMessage } from '@/utils';
import { URL_2 } from '@/config/urls';

const ProfileSettingsForm = () => {
  const { currentUser, setCurrentUser } = useAuthContext();
  const [saveUser, { loading }] = useMutation(CREATE_USER);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [district, setDistrict] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    setName(currentUser?.name ?? '');
    setEmail(currentUser?.email ?? '');
    setDistrict(currentUser?.district ?? '');
    setPreviewUrl(currentUser?.image ? `${URL_2}/imgs/${currentUser.image}` : '');
  }, [currentUser]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id || !currentUser?.username) return;

    try {
      const { data }: any = await saveUser({
        variables: {
          payload: {
            id: String(currentUser.id),
            username: currentUser.username,
            name,
            email,
            district,
            ...(imageFile ? { image: imageFile } : {}),
          },
        },
      });

      const updated = data?.createUser?.user;
      if (updated) {
        setCurrentUser((prev) => (prev ? { ...prev, ...updated } : prev));
      }
      setImageFile(null);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error(toFriendlyErrorMessage(error, 'Unable to update your profile. Please try again.'));
    }
  };

  return (
    <div className="card min-w-full">
      <div className="card-header">
        <h3 className="card-title">Edit Profile</h3>
      </div>
      <form onSubmit={handleSubmit} className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 flex items-center gap-4">
          <img
            src={previewUrl || toAbsoluteUrl('/media/avatars/blank.png')}
            alt="Avatar preview"
            className="size-14 rounded-full object-cover border border-gray-200"
          />
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setImageFile(file);
                setPreviewUrl(URL.createObjectURL(file));
              }}
              className="block text-sm text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Name</label>
          <input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Email</label>
          <input
            type="email"
            className="input w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">District</label>
          <input
            className="input w-full"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            required
          />
        </div>

        <div className="sm:col-span-2 flex justify-end">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export { ProfileSettingsForm };
