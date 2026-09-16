import { Fragment } from 'react';
import { Helmet } from 'react-helmet-async';
import { Outlet, useLocation } from 'react-router';
import { useAuthContext } from '@/auth';
import { useMenuCurrentItem } from '@/components/menu';
import { useMenus } from '@/providers';
import { Footer, Header, Sidebar } from '..';
import { Download, Plus, RefreshCw } from 'lucide-react';
import { useDemo8Layout } from '..';

const Main = () => {
  const { pathname } = useLocation();
  const { currentUser } = useAuthContext();
  const { pageActions } = useDemo8Layout();
  const { getMenuConfig } = useMenus();
  const menuItem = useMenuCurrentItem(pathname, getMenuConfig('primary'));
  const workspaceName = currentUser?.name
    ? `${currentUser.name}'s Workspace`
    : 'Requisition Management Workspace';

  return (
    <Fragment>
      <Helmet>
        <title>{menuItem?.title ? `${menuItem.title} · NAD Requisition` : 'NAD Requisition'}</title>
      </Helmet>

      <div className="flex min-h-screen flex-col bg-[#f3f6f9] dark:bg-[--tw-page-bg-dark]">
        <Header />
        <Sidebar />

        <div className="w-screen max-w-[100vw] overflow-x-clip border-b border-slate-200 bg-white dark:border-gray-200 dark:bg-[--tw-content-bg-dark]">
          <div className="mx-auto flex min-h-16 w-full max-w-[1536px] items-center justify-between gap-4 px-4 py-2.5 sm:px-6 lg:px-8">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold tracking-[-0.015em] text-[#172550] dark:text-gray-900 sm:text-xl">
                {menuItem?.title || workspaceName}
              </h1>
            </div>
            {pageActions.length > 0 && (
              <div className="flex shrink-0 items-center gap-2">
                {pageActions.map((action) => {
                  const Icon = action.icon === 'download'
                    ? Download
                    : action.icon === 'refresh'
                      ? RefreshCw
                      : Plus;
                  const isSecondary = action.variant === 'secondary';

                  return (
                    <button
                      key={action.label}
                      type="button"
                      onClick={action.onClick}
                      disabled={action.disabled}
                      className={isSecondary
                        ? 'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition-[background-color,border-color,transform] duration-150 hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#2aaed3] focus-visible:ring-offset-2 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 sm:px-3.5'
                        : 'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#2aaed3] px-3 text-sm font-bold text-white shadow-[0_8px_18px_-10px_rgba(42,174,211,0.9)] outline-none transition-[background-color,box-shadow,transform] duration-150 hover:bg-[#239abd] focus-visible:ring-2 focus-visible:ring-[#2aaed3] focus-visible:ring-offset-2 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 sm:px-4'}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      <span>{action.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
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
