import clsx from 'clsx';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { IMenuItemConfig } from '@/components/menu';
import { KeenIcon } from '@/components/keenicons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useMenus } from '@/providers';

interface ISidebarMenuProps {
  mobile?: boolean;
  activeSection?: IMenuItemConfig | null;
  onOpenSection?: (item: IMenuItemConfig) => void;
}

const pathMatches = (target: string | undefined, pathname: string) => {
  if (!target) return false;
  if (target === '/dashboard') return pathname === target;
  return pathname === target || pathname.startsWith(`${target}/`);
};

const isMenuItemActive = (item: IMenuItemConfig, pathname: string): boolean =>
  pathMatches(item.path, pathname) ||
  Boolean(item.children?.some((child) => isMenuItemActive(child, pathname)));

const SidebarMenu = ({ mobile = false, activeSection = null, onOpenSection }: ISidebarMenuProps) => {
  const { pathname } = useLocation();
  const { getMenuConfig } = useMenus();
  const menuConfig = (getMenuConfig('primary') || []).filter((item) => !item.disabled);

  if (mobile) {
    const visibleItems = activeSection?.children?.filter((item) => !item.disabled) || menuConfig;

    return (
      <nav aria-label={activeSection ? `${activeSection.title} navigation` : 'Primary navigation'}>
        <ul className="flex flex-col">
          {visibleItems.map((item, index) => {
            const active = isMenuItemActive(item, pathname);
            const hasChildren = !activeSection && Boolean(item.children?.length);
            const rowClass = clsx(
              'ease-premium group flex min-h-14 w-full items-center gap-3 border-b border-slate-200/80 px-5 text-left text-[15px] font-semibold outline-none transition-[background-color,color,transform] duration-150 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2aaed3] active:scale-[0.99] motion-reduce:transition-none motion-reduce:transform-none',
              active ? 'bg-[#e9f8fc] text-[#172550]' : 'text-slate-700 hover:bg-slate-50'
            );

            return (
              <li key={`${item.path || item.title}-${index}`}>
                {hasChildren ? (
                  <button type="button" className={rowClass} onClick={() => onOpenSection?.(item)}>
                    {item.icon && (
                      <KeenIcon icon={item.icon} className="text-lg text-[#2aaed3]" />
                    )}
                    <span>{item.title}</span>
                    <ChevronRight aria-hidden="true" className="ml-auto size-4 text-slate-400" />
                  </button>
                ) : (
                  <Link
                    to={item.path || '/dashboard'}
                    className={rowClass}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.icon && (
                      <KeenIcon icon={item.icon} className="text-lg text-[#2aaed3]" />
                    )}
                    <span>{item.title}</span>
                    <ChevronRight
                      aria-hidden="true"
                      className="ml-auto size-4 text-slate-300 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transform-none"
                    />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  const tabClass = (active: boolean) =>
    clsx(
      'group relative flex h-full items-center px-1 outline-none after:absolute after:inset-x-1 after:bottom-0 after:h-[4px] after:origin-center after:rounded-t-full after:bg-[#72d6ee] after:transition-transform after:duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#72d6ee]',
      active ? 'after:scale-x-100' : 'after:scale-x-0'
    );

  const labelClass = (active: boolean) =>
    clsx(
      'ease-premium flex items-center gap-1.5 rounded-full px-3.5 py-2.5 text-sm font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none',
      active
        ? 'bg-[#0f2555] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]'
        : 'text-white/75 hover:bg-white/[0.07] hover:text-white'
    );

  return (
    <nav aria-label="Primary navigation" className="h-full">
      <ul className="flex h-full items-stretch gap-0.5">
        {menuConfig.map((item, index) => {
          const active = isMenuItemActive(item, pathname);
          const hasChildren = Boolean(item.children?.length);

          return (
            <li key={`${item.path || item.title}-${index}`} className="flex h-full items-stretch">
              {hasChildren ? (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className={tabClass(active)} aria-current={active ? 'page' : undefined}>
                      <span className={labelClass(active)}>
                        {item.title}
                        <ChevronDown
                          aria-hidden="true"
                          className="size-3.5 text-white/60 transition-transform duration-150 group-data-[state=open]:rotate-180 motion-reduce:transform-none"
                        />
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    sideOffset={9}
                    className="w-[290px] rounded-xl border-slate-200 bg-white p-2 text-[#172550] shadow-[0_18px_50px_rgba(16,35,72,0.22)] data-[state=open]:duration-150 data-[state=closed]:duration-100"
                  >
                    {item.children?.filter((child) => !child.disabled).map((child, childIndex) => {
                      const childActive = isMenuItemActive(child, pathname);
                      return (
                        <DropdownMenuItem key={`${child.path || child.title}-${childIndex}`} asChild>
                          <Link
                            to={child.path || '/dashboard'}
                            aria-current={childActive ? 'page' : undefined}
                            className={clsx(
                              'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold outline-none transition-colors focus:bg-[#e9f8fc] focus:text-[#172550]',
                              childActive ? 'bg-[#e9f8fc] text-[#172550]' : 'text-slate-600'
                            )}
                          >
                            {child.icon && (
                              <KeenIcon icon={child.icon} className="text-base text-[#2aaed3]" />
                            )}
                            <span>{child.title}</span>
                            {childActive && (
                              <span className="ml-auto size-1.5 rounded-full bg-[#2aaed3]" aria-hidden="true" />
                            )}
                          </Link>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link
                  to={item.path || '/dashboard'}
                  className={tabClass(active)}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className={labelClass(active)}>{item.title}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export { SidebarMenu, isMenuItemActive };
