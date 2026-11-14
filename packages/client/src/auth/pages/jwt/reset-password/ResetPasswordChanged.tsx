import { Link } from 'react-router-dom';
import { toAbsoluteUrl } from '@/utils';
import { useLayout } from '@/providers';

const ResetPasswordChanged = () => {
  const { currentLayout } = useLayout();

  return (
    <div className="card max-w-[440px] w-full">
      <div className="card-body p-10">
        <div className="flex justify-center mb-5">
          <img
            src={toAbsoluteUrl('/media/illustrations/32.svg')}
            className="dark:hidden max-h-[180px]"
            alt=""
          />
          <img
            src={toAbsoluteUrl('/media/illustrations/32-dark.svg')}
            className="light:hidden max-h-[180px]"
            alt=""
          />
        </div>

        <h3 className="text-lg font-medium text-gray-900 text-center mb-4">
          Your password is changed
        </h3>
        <div className="text-2sm text-center text-gray-700 mb-7.5">
          Your password has been successfully updated.
          <br />
          Your account's security is our priority.
        </div>

        <div className="flex justify-center">
          <Link
            to={currentLayout?.name === 'auth-branded' ? '/auth/login' : '/auth/classic/login'}
            // className="btn btn-primary"
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#172550] px-4 text-sm font-bold text-white shadow-[0_12px_24px_-14px_rgba(23,37,80,0.9)] outline-none transition-[background-color,box-shadow,transform] duration-150 hover:bg-[#213363] hover:shadow-[0_15px_28px_-14px_rgba(23,37,80,0.95)] focus-visible:ring-4 focus-visible:ring-[#72d6ee]/45 focus-visible:ring-offset-2 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-65 disabled:shadow-none disabled:active:scale-100"
            
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export { ResetPasswordChanged };
