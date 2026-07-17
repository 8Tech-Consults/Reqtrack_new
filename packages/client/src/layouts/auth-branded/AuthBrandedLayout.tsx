import { Link, Outlet } from 'react-router-dom';
import { Fragment } from 'react';
import { toAbsoluteUrl } from '@/utils';
import useBodyClasses from '@/hooks/useBodyClasses';
import { AuthBrandedLayoutProvider } from './AuthBrandedLayoutProvider';

const Layout = () => {
  // Applying body classes to manage the background color in dark mode
  useBodyClasses('dark:bg-coal-500');

  return (
    <Fragment>
      <style>
        {`
          .branded-bg {
            background-image:
              radial-gradient(circle at 18% 18%, rgba(255, 255, 255, 0.18), transparent 28%),
              linear-gradient(145deg, rgba(37, 99, 235, 0.96) 0%, rgba(59, 130, 246, 0.94) 48%, rgba(29, 78, 216, 0.96) 100%),
              url('${toAbsoluteUrl('/media/images/2600x1600/1.png')}');
            background-size: cover;
            background-position: center;
          }
          .dark .branded-bg {
            background-image:
              radial-gradient(circle at 18% 18%, rgba(255, 255, 255, 0.12), transparent 28%),
              linear-gradient(145deg, rgba(15, 23, 42, 0.96) 0%, rgba(30, 41, 59, 0.94) 48%, rgba(30, 64, 175, 0.96) 100%),
              url('${toAbsoluteUrl('/media/images/2600x1600/1-dark.png')}');
            background-size: cover;
            background-position: center;
          }
        `}
      </style>

      <div className="grid min-h-screen lg:grid-cols-[1.12fr_0.88fr] grow bg-white">
        <div className="relative order-1 overflow-hidden branded-bg">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(37,99,235,0.10)_0%,rgba(15,23,42,0.05)_100%)]" />
          <div className="relative flex h-full flex-col justify-between p-8 lg:p-14 text-white">
            <Link to="/" className="inline-flex items-center gap-3 w-fit">
              <img
                src={toAbsoluteUrl('/media/app/mini-logo.svg')}
                className="h-[34px] max-w-none brightness-0 invert"
                alt="NAD Requisition"
              />
            </Link>

            <div className="max-w-[34rem] space-y-5">
              <div className="inline-flex w-fit items-center rounded-full border border-white/25 bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/90 backdrop-blur-sm">
                NAD Requisition
              </div>

              <div className="space-y-4">
                <h1 className="max-w-[10ch] text-4xl lg:text-6xl font-semibold leading-[0.98] tracking-tight text-white">
                  Let&apos;s make every day meaningful together.
                </h1>
                <p className="max-w-[30rem] text-base lg:text-lg leading-7 text-white/88">
                  A secure workflow for managing users, requisitions, and accountability records
                  across the NAD system.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl pt-2">
                <div className="rounded-2xl border border-white/20 bg-white/12 px-4 py-3 text-sm font-medium text-white backdrop-blur-sm">
                  Centralized user administration
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/12 px-4 py-3 text-sm font-medium text-white backdrop-blur-sm">
                  Requisition tracking with audit visibility
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/12 px-4 py-3 text-sm font-medium text-white backdrop-blur-sm">
                  Role-aware access control
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/12 px-4 py-3 text-sm font-medium text-white backdrop-blur-sm">
                  Accountability and reporting in one place
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="order-2 flex items-center justify-center px-5 py-10 lg:px-12 lg:py-10 bg-[#f8fbff]">
          <Outlet />
        </div>
      </div>
    </Fragment>
  );
};

// AuthBrandedLayout component that wraps the Layout component with AuthBrandedLayoutProvider
const AuthBrandedLayout = () => (
  <AuthBrandedLayoutProvider>
    <Layout />
  </AuthBrandedLayoutProvider>
);

export { AuthBrandedLayout };
