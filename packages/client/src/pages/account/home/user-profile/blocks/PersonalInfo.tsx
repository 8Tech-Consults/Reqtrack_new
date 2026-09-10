import { useAuthContext } from '@/auth';
import { toAbsoluteUrl } from '@/utils';
import { URL_2 } from '@/config/urls';

const PersonalInfo = () => {
  const { currentUser } = useAuthContext();

  const avatarSrc = currentUser?.image
    ? `${URL_2}/imgs/${currentUser.image}`
    : toAbsoluteUrl('/media/avatars/blank.png');

  return (
    <div className="card min-w-full">
      <div className="card-body flex flex-col items-center text-center gap-3 py-7.5">
        <img
          src={avatarSrc}
          alt={currentUser?.name || currentUser?.username || 'User avatar'}
          className="size-20 rounded-full object-cover border border-gray-200"
        />
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            {currentUser?.name || currentUser?.username || '—'}
          </h3>
          <p className="text-sm text-gray-500">@{currentUser?.username}</p>
        </div>
        {currentUser?.role_name && (
          <span className="badge badge-sm badge-primary badge-outline">{currentUser.role_name}</span>
        )}
        <div className="w-full border-t border-gray-100 pt-4 mt-1 space-y-2 text-left">
          <div className="flex items-center justify-between text-sm gap-2">
            <span className="text-gray-500 shrink-0">Email</span>
            <span className="text-gray-800 font-medium truncate">{currentUser?.email || '—'}</span>
          </div>
          <div className="flex items-center justify-between text-sm gap-2">
            <span className="text-gray-500 shrink-0">District</span>
            <span className="text-gray-800 font-medium truncate">{currentUser?.district || '—'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export { PersonalInfo };
