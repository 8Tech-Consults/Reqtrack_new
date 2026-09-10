import { useRef, useState } from 'react';
import {
  Bell,
  ChevronDown,
  CircleHelp,
  Grid3X3,
  Menu as MenuIcon,
  MessageCircle,
  MoreVertical,
  Plus,
  Search
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Menu as AppMenu, MenuItem, MenuToggle } from '@/components';
import { useAuthContext } from '@/auth';
import { useLanguage } from '@/i18n';
import { toAbsoluteUrl } from '@/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { DropdownApps } from '@/partials/dropdowns/apps';
import { DropdownChat } from '@/partials/dropdowns/chat';
import { DropdownNotifications } from '@/partials/dropdowns/notifications';
import { DropdownUser } from '@/partials/dropdowns/user';
import { ModalSearch } from '@/partials/modals/search/ModalSearch';
import { SidebarMenu } from '../sidebar';
import { useDemo8Layout } from '../';

const Header = () => {
  const { setMobileSidebarOpen } = useDemo8Layout();
  const { currentUser } = useAuthContext();
  const { isRTL } = useLanguage();
  const itemNotificationsRef = useRef<any>(null);
  const itemChatRef = useRef<any>(null);
  const itemAppsRef = useRef<any>(null);
  const itemUserRef = useRef<any>(null);
  const itemMobileUserRef = useRef<any>(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  const displayName =
    currentUser?.fullname ||
    [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(' ') ||
    currentUser?.username ||
    'Account';
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const workspaceName = currentUser?.companyName || 'NAD Workspace';

  const actionClass =
    'ease-premium relative inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/80 outline-none transition-[background-color,color,transform] duration-150 hover:bg-white/[0.13] hover:text-white focus-visible:ring-2 focus-visible:ring-[#72d6ee] focus-visible:ring-offset-2 focus-visible:ring-offset-[#172550] active:scale-[0.96] motion-reduce:transition-none motion-reduce:transform-none xl:size-11';
  const mobileActionClass =
    'ease-premium inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-white outline-none transition-[background-color,transform] duration-150 hover:bg-white/[0.16] focus-visible:ring-2 focus-visible:ring-[#72d6ee] active:scale-[0.96] motion-reduce:transition-none motion-reduce:transform-none';
  const userButtonClass =
    'ease-premium flex size-10 items-center justify-center rounded-full border-2 border-white/20 bg-[#72d6ee] text-xs font-bold text-[#12204a] outline-none transition-[border-color,transform] duration-150 hover:border-white/70 focus-visible:ring-2 focus-visible:ring-white active:scale-[0.96] motion-reduce:transition-none motion-reduce:transform-none xl:size-11';

  const dropdownPlacement = {
    placement: isRTL() ? ('bottom-start' as const) : ('bottom-end' as const),
    modifiers: [{ name: 'offset', options: { offset: [0, 12] } }]
  };

  return (
    <>
      <a
        href="#main-content"
        className="sr-only z-[100] rounded-lg bg-white px-4 py-2 text-[#172550] focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <header className="nad-app-header sticky top-0 z-40 w-screen max-w-[100vw] shrink-0 overflow-x-clip border-b border-white/10 bg-[#172550] text-white">
        <div className="hidden h-full w-full items-stretch px-5 lg:flex xl:px-6">
          <div className="flex shrink-0 items-center gap-3">
            <Link
              to="/dashboard"
              aria-label="NAD dashboard"
              className="group flex items-center gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#72d6ee] focus-visible:ring-offset-2 focus-visible:ring-offset-[#172550]"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-white shadow-[0_6px_22px_rgba(5,14,45,0.22)]">
                <img src={toAbsoluteUrl('/media/images/logo.png')} className="size-9 object-contain" alt="" />
              </span>
              <span className="text-base font-bold tracking-[-0.01em]">NAD</span>
            </Link>

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="ease-premium flex max-w-44 items-center gap-2 rounded-full bg-white/[0.07] px-3.5 py-2.5 text-sm font-semibold text-white/90 outline-none transition-[background-color,transform] duration-150 hover:bg-white/[0.12] focus-visible:ring-2 focus-visible:ring-[#72d6ee] active:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none"
                >
                  <span className="truncate">{workspaceName}</span>
                  <ChevronDown className="size-3.5 shrink-0 text-white/60" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                sideOffset={9}
                className="w-72 rounded-xl border-slate-200 bg-white p-2 text-[#172550] shadow-[0_18px_50px_rgba(16,35,72,0.22)]"
              >
                <DropdownMenuLabel className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  Current workspace
                </DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link
                    to="/dashboard"
                    className="flex min-h-11 cursor-pointer items-center rounded-lg px-3 text-sm font-semibold focus:bg-[#e9f8fc]"
                  >
                    {workspaceName}
                    <span className="ml-auto size-1.5 rounded-full bg-[#2aaed3]" />
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-2 bg-slate-200" />
                <DropdownMenuItem asChild>
                  <Link
                    to="/account/home/company-profile"
                    className="flex min-h-11 cursor-pointer items-center rounded-lg px-3 text-sm font-semibold text-slate-600 focus:bg-[#e9f8fc] focus:text-[#172550]"
                  >
                    Workspace settings
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="min-w-0 flex-1 items-stretch px-3 xl:px-5">
            <SidebarMenu />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <Link to="/requisitions" className={actionClass} aria-label="Open requisitions" title="Requisitions">
              <Plus className="size-5" />
            </Link>

            <button
              type="button"
              className={actionClass}
              onClick={() => setSearchModalOpen(true)}
              aria-label="Search"
              title="Search"
            >
              <Search className="size-5" />
            </button>

            <div className="hidden xl:block">
              <AppMenu>
                <MenuItem
                  ref={itemChatRef}
                  toggle="dropdown"
                  trigger="click"
                  onShow={() => window.dispatchEvent(new Event('resize'))}
                  dropdownProps={dropdownPlacement}
                >
                  <MenuToggle className={actionClass} aria-label="Messages">
                    <MessageCircle className="size-5" />
                  </MenuToggle>
                  {DropdownChat({ menuTtemRef: itemChatRef })}
                </MenuItem>
              </AppMenu>
            </div>

            <Link
              to="/account/home/get-started"
              className={actionClass + ' hidden 2xl:inline-flex'}
              aria-label="Help"
              title="Help"
            >
              <CircleHelp className="size-5" />
            </Link>

            <div className="hidden xl:block">
              <AppMenu>
                <MenuItem
                  ref={itemNotificationsRef}
                  toggle="dropdown"
                  trigger="click"
                  dropdownProps={dropdownPlacement}
                >
                  <MenuToggle className={actionClass} aria-label="Notifications">
                    <Bell className="size-5" />
                    <span className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-[#72d6ee] ring-2 ring-[#172550]" />
                  </MenuToggle>
                  {DropdownNotifications({ menuTtemRef: itemNotificationsRef })}
                </MenuItem>
              </AppMenu>
            </div>

            <div className="hidden xl:block">
              <AppMenu>
                <MenuItem
                  ref={itemAppsRef}
                  toggle="dropdown"
                  trigger="click"
                  dropdownProps={dropdownPlacement}
                >
                  <MenuToggle className={actionClass} aria-label="Apps">
                    <Grid3X3 className="size-5" />
                  </MenuToggle>
                  {DropdownApps()}
                </MenuItem>
              </AppMenu>
            </div>

            <span className="mx-1 h-7 w-px bg-white/15" aria-hidden="true" />

            <AppMenu>
              <MenuItem
                ref={itemUserRef}
                toggle="dropdown"
                trigger="click"
                dropdownProps={dropdownPlacement}
              >
                <MenuToggle className={userButtonClass} aria-label={`Open account menu for ${displayName}`}>
                  {initials}
                </MenuToggle>
                {DropdownUser({ menuItemRef: itemUserRef })}
              </MenuItem>
            </AppMenu>
          </div>
        </div>

        <div className="flex h-full w-full items-center gap-3 px-4 lg:hidden">
          <button
            type="button"
            className={mobileActionClass + ' bg-transparent'}
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <MenuIcon className="size-6" />
          </button>

          <Link
            to="/dashboard"
            aria-label="NAD dashboard"
            className="flex items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#72d6ee]"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-white">
              <img src={toAbsoluteUrl('/media/images/logo.png')} className="size-8" alt="" />
            </span>
            <span className="hidden text-sm font-bold sm:block">NAD</span>
          </Link>

          <div className="ml-auto flex items-center gap-1.5">
            <Link to="/requisitions" className={mobileActionClass} aria-label="Open requisitions">
              <Plus className="size-5" />
            </Link>

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button type="button" className={mobileActionClass} aria-label="More actions">
                  <MoreVertical className="size-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={9}
                className="w-56 rounded-xl border-slate-200 bg-white p-2 text-[#172550] shadow-[0_18px_50px_rgba(16,35,72,0.22)]"
              >
                <DropdownMenuItem
                  className="min-h-11 cursor-pointer gap-3 rounded-lg px-3 text-sm font-semibold focus:bg-[#e9f8fc]"
                  onSelect={() => setSearchModalOpen(true)}
                >
                  <Search className="size-4.5 text-[#2aaed3]" /> Search
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    to="/account/notifications"
                    className="min-h-11 cursor-pointer gap-3 rounded-lg px-3 text-sm font-semibold focus:bg-[#e9f8fc]"
                  >
                    <Bell className="size-4.5 text-[#2aaed3]" /> Notifications
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    to="/account/home/get-started"
                    className="min-h-11 cursor-pointer gap-3 rounded-lg px-3 text-sm font-semibold focus:bg-[#e9f8fc]"
                  >
                    <CircleHelp className="size-4.5 text-[#2aaed3]" /> Help
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <AppMenu>
              <MenuItem
                ref={itemMobileUserRef}
                toggle="dropdown"
                trigger="click"
                dropdownProps={dropdownPlacement}
              >
                <MenuToggle className={userButtonClass} aria-label={`Open account menu for ${displayName}`}>
                  {initials}
                </MenuToggle>
                {DropdownUser({ menuItemRef: itemMobileUserRef })}
              </MenuItem>
            </AppMenu>
          </div>
        </div>
      </header>

      <ModalSearch open={searchModalOpen} onOpenChange={() => setSearchModalOpen(false)} />
    </>
  );
};

export { Header };
