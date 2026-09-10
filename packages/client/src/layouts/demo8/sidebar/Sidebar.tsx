/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { IMenuItemConfig } from '@/components/menu';
import { useAuthContext } from '@/auth';
import { usePathname } from '@/providers';
import { toAbsoluteUrl } from '@/utils';
import { useDemo8Layout } from '..';
import { SidebarMenu } from '.';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';

const Sidebar = () => {
  const { pathname, prevPathname } = usePathname();
  const { currentUser } = useAuthContext();
  const { mobileSidebarOpen, setMobileSidebarOpen } = useDemo8Layout();
  const [activeSection, setActiveSection] = useState<IMenuItemConfig | null>(null);

  const displayName =
    currentUser?.fullname ||
    [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(' ') ||
    currentUser?.username ||
    'Account';

  useEffect(() => {
    if (prevPathname !== pathname) {
      setMobileSidebarOpen(false);
      setActiveSection(null);
    }
  }, [pathname, prevPathname]);

  const handleOpenChange = (open: boolean) => {
    setMobileSidebarOpen(open);
    if (!open) {
      setActiveSection(null);
      window.setTimeout(() => {
        document.querySelector<HTMLElement>('[aria-label="Open navigation"]')?.focus();
      }, 0);
    }
  };

  return (
    <Sheet open={mobileSidebarOpen} onOpenChange={handleOpenChange}>
      <SheetContent
        side="left"
        className="flex w-[86vw] max-w-[380px] flex-col gap-0 border-0 bg-white p-0 shadow-[24px_0_64px_rgba(8,24,54,0.28)] data-[state=open]:duration-200 data-[state=closed]:duration-150 sm:w-[60vw] lg:hidden"
        overlayClassName="bg-[#101c38]/70 backdrop-blur-[2px] data-[state=open]:duration-200 data-[state=closed]:duration-150"
        close={false}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{activeSection?.title || 'Primary navigation'}</SheetTitle>
          <SheetDescription>Navigate the NAD requisition workspace</SheetDescription>
        </SheetHeader>

        <div className="flex min-h-20 items-center justify-between gap-3 border-b border-slate-200 px-5">
          {activeSection ? (
            <>
              <div className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#2aaed3]">
                  Section
                </span>
                <span className="block truncate text-lg font-bold text-[#172550]">
                  {activeSection.title}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection(null)}
                className="ease-premium flex size-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-[#172550] outline-none transition-[background-color,border-color,transform] duration-150 hover:border-[#b9e8f4] hover:bg-[#e9f8fc] focus-visible:ring-2 focus-visible:ring-[#2aaed3] active:scale-[0.96] motion-reduce:transition-none motion-reduce:transform-none"
                aria-label="Back to primary navigation"
              >
                <ArrowLeft className="size-4.5" />
              </button>
            </>
          ) : (
            <>
              <Link
                to="/dashboard"
                className="flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#2aaed3]"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-[#e9f8fc]">
                  <img src={toAbsoluteUrl('/media/images/logo.png')} className="size-9" alt="" />
                </span>
                <span>
                  <span className="block text-base font-bold text-[#172550]">NAD</span>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Requisition workspace
                  </span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="ease-premium flex size-10 items-center justify-center rounded-full text-slate-500 outline-none transition-[background-color,color,transform] duration-150 hover:bg-slate-100 hover:text-[#172550] focus-visible:ring-2 focus-visible:ring-[#2aaed3] active:scale-[0.96] motion-reduce:transition-none motion-reduce:transform-none"
                aria-label="Close navigation"
              >
                <X className="size-5" />
              </button>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          <SidebarMenu
            mobile
            activeSection={activeSection}
            onOpenSection={setActiveSection}
          />
        </div>

        <div className="border-t border-slate-200 bg-slate-50/80 p-4">
          <Link
            to="/account/home/user-profile"
            className="ease-premium flex items-center gap-3 rounded-xl px-2 py-2 outline-none transition-[background-color,transform] duration-150 hover:bg-white focus-visible:ring-2 focus-visible:ring-[#2aaed3] active:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-[#172550] text-xs font-bold text-white">
              {displayName.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-800">{displayName}</span>
              <span className="block truncate text-xs text-slate-500">View account</span>
            </span>
            <span className="ml-auto text-xs font-semibold text-[#2aaed3]">Account</span>
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export { Sidebar };
