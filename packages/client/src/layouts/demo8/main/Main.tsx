import { Fragment } from 'react';
import { Helmet } from 'react-helmet-async';
import { Outlet, useLocation } from 'react-router';
import { useAuthContext } from '@/auth';
import { useMenuCurrentItem } from '@/components/menu';
import { useMenus } from '@/providers';
import { Footer, Header, Sidebar } from '..';

const Main = () => {
  const { pathname } = useLocation();
  const { currentUser } = useAuthContext();
  const { getMenuConfig } = useMenus();
  const menuItem = useMenuCurrentItem(pathname, getMenuConfig('primary'));
  const workspaceName = currentUser?.companyName || 'Requisition Management Workspace';

  return (
    <Fragment>
      <Helmet>
        <title>{menuItem?.title ? `${menuItem.title} · NAD Requisition` : 'NAD Requisition'}</title>
      </Helmet>

      <div className="flex min-h-screen flex-col bg-[#f3f6f9] dark:bg-[--tw-page-bg-dark]">
        <Header />
        <Sidebar />

        <div className="w-screen max-w-[100vw] overflow-x-clip border-b border-slate-200 bg-white dark:border-gray-200 dark:bg-[--tw-content-bg-dark]">
          <div className="mx-auto flex min-h-[58px] w-full max-w-[1536px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#172550] dark:text-gray-900 sm:text-[15px]">
                {/* {workspaceName} */}
                {menuItem?.title || workspaceName}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-slate-400 sm:hidden">
                {menuItem?.title || 'Workspace'}
              </p>
            </div>
            {/* <div className="hidden items-center gap-2 text-xs font-medium text-slate-500 sm:flex">
              <span className="size-1.5 rounded-full bg-[#35b9de]" aria-hidden="true" />
              <span>Current view</span>
              <span className="font-semibold text-slate-700">{menuItem?.title || 'Workspace'}</span>
            </div> */}
          </div>
        </div>

        <main id="main-content" className="grow py-2 sm:py-3 lg:py-4" role="main">
          <Outlet />
        </main>

        <Footer />
      </div>
    </Fragment>
  );
};

export { Main };
