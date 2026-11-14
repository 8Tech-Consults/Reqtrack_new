import { Link } from 'react-router-dom';

import { toAbsoluteUrl } from '@/utils';
import { useLayout } from '@/providers';
import { useEffect, useState } from 'react';

const ResetPasswordCheckEmail = () => {
  const { currentLayout } = useLayout();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    setEmail(new URLSearchParams(window.location.search).get('email'));
  }, []);

  return (
    <div className="card max-w-[440px] w-full">
      <div className="card-body p-10">
        <div className="flex justify-center py-10">
          <img
            src={toAbsoluteUrl('/media/illustrations/30.svg')}
            className="dark:hidden max-h-[130px]"
            alt=""
          />
          <img
            src={toAbsoluteUrl('/media/illustrations/30-dark.svg')}
            className="light:hidden max-h-[130px]"
            alt=""
          />
        </div>

        <h3 className="text-lg font-medium text-gray-900 text-center mb-3">Check your email</h3>
        <div className="text-2sm text-center text-gray-700 mb-7.5">
          Please click the link sent to your email{' '}
          <a href="#" className="text-2sm text-gray-800 font-medium hover:text-primary-active">
            {email}
          </a>
          <br />
          to reset your password. Thank you
        </div>

        <div className="flex justify-center mb-5">
          <Link
            to={
              currentLayout?.name === 'auth-branded'
                ? '/auth/reset-password/changed'
                : '/auth/classic/reset-password/changed'
            }
            // className="btn btn-primary flex justify-center"
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#172550] px-4 text-sm font-bold text-white shadow-[0_12px_24px_-14px_rgba(23,37,80,0.9)] outline-none transition-[background-color,box-shadow,transform] duration-150 hover:bg-[#213363] hover:shadow-[0_15px_28px_-14px_rgba(23,37,80,0.95)] focus-visible:ring-4 focus-visible:ring-[#72d6ee]/45 focus-visible:ring-offset-2 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-65 disabled:shadow-none disabled:active:scale-100"
          
          >
            Skip for now
          </Link>
        </div>

        <div className="flex items-center justify-center gap-1">
          <span className="text-xs text-gray-600">Didn’t receive an email?</span>
          <Link
            to={
              currentLayout?.name === 'auth-branded'
                ? '/auth/reset-password/enter-email'
                : '/auth/classic/reset-password/enter-email'
            }
            className="text-xs font-medium link"
          >
            Resend
          </Link>
        </div>
      </div>
    </div>
  );
};

export { ResetPasswordCheckEmail };
