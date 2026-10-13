import { Fragment } from 'react';
import { Outlet } from 'react-router-dom';
import useBodyClasses from '@/hooks/useBodyClasses';
import { toAbsoluteUrl } from '@/utils';
import { AuthBrandedLayoutProvider } from './AuthBrandedLayoutProvider';

const Layout = () => {
  useBodyClasses('bg-[#101b3f]');

  return (
    <Fragment>
      <style>
        {`
          .nad-auth-background {
            background-image:
              linear-gradient(135deg, rgba(9, 20, 52, 0.88) 0%, rgba(23, 37, 80, 0.72) 48%, rgba(12, 26, 60, 0.82) 100%),
              url('${toAbsoluteUrl('/media/images/image1.jpg')}');
            background-position: center;
            background-repeat: no-repeat;
            background-size: cover;
          }

          .nad-auth-background::before {
            background:
              radial-gradient(circle at 18% 20%, rgba(114, 214, 238, 0.22), transparent 30%),
              radial-gradient(circle at 84% 84%, rgba(42, 174, 211, 0.14), transparent 32%);
            content: '';
            inset: 0;
            pointer-events: none;
            position: absolute;
          }

          .nad-login-card {
            background-color: rgba(255, 255, 255, 0.94);
          }

          @media (max-width: 639px) {
            .nad-auth-background {
              background-position: 58% center;
            }
          }
        `}
      </style>

      <main className="nad-auth-background relative flex min-h-[100svh] w-full grow flex-col items-center overflow-x-hidden overflow-y-auto px-4 py-5 sm:px-6 sm:py-8">
        <div className="relative z-10 flex w-full flex-1 items-center justify-center py-3 sm:py-4">
          <Outlet />
        </div>

        <p className="relative z-10 shrink-0 py-1 text-center text-[11px] font-medium tracking-wide text-white/55">
          Powered by <a href="https://8technologies.net" target="_blank" rel="noopener noreferrer" className="text-[#2aaed3]">Eight Tech Consults Ltd</a>
        </p>
      </main>
    </Fragment>
  );
};

const AuthBrandedLayout = () => (
  <AuthBrandedLayoutProvider>
    <Layout />
  </AuthBrandedLayoutProvider>
);

export { AuthBrandedLayout };
