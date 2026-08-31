import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { FormattedMessage } from 'react-intl';
import { useAuthContext } from '@/auth';
import { toAbsoluteUrl } from '@/utils';
import { URL_2 } from '@/config/urls';
import { KeenIcon } from '@/components';
import { MenuItem, MenuLink, MenuSub, MenuTitle, MenuSeparator, MenuIcon } from '@/components/menu';

interface IDropdownUserProps {
  menuItemRef: any;
}

const DropdownUser = ({ menuItemRef }: IDropdownUserProps) => {
  const { currentUser, logout } = useAuthContext();

  const avatarSrc = currentUser?.image
    ? `${URL_2}/imgs/${currentUser.image}`
    : toAbsoluteUrl('/media/avatars/blank.png');

  const buildHeader = () => {
    return (
      <div className="flex items-center justify-between px-5 py-1.5 gap-1.5">
        <div className="flex items-center gap-2">
          <img
            className="size-9 rounded-full border-2 border-success object-cover"
            src={avatarSrc}
            alt=""
          />
          <div className="flex flex-col gap-1.5">
            <Link
              to="/account/home/user-profile"
              className="text-sm text-gray-800 hover:text-primary font-semibold leading-none"
            >
              {currentUser?.name || currentUser?.username || 'My Account'}
            </Link>
            {currentUser?.email && (
              <a
                href={`mailto:${currentUser.email}`}
                className="text-xs text-gray-600 hover:text-primary font-medium leading-none"
              >
                {currentUser.email}
              </a>
            )}
          </div>
        </div>
        {currentUser?.role_name && (
          <span className="badge badge-xs badge-primary badge-outline">{currentUser.role_name}</span>
        )}
      </div>
    );
  };

  const buildMenu = () => {
    return (
      <Fragment>
        <MenuSeparator />
        <div className="flex flex-col">
          <MenuItem>
            <MenuLink path="/account/home/user-profile">
              <MenuIcon>
                <KeenIcon icon="profile-circle" />
              </MenuIcon>
              <MenuTitle>
                <FormattedMessage id="USER.MENU.MY_PROFILE" />
              </MenuTitle>
            </MenuLink>
          </MenuItem>
          <MenuSeparator />
        </div>
      </Fragment>
    );
  };

  const buildFooter = () => {
    return (
      <div className="flex flex-col">
        <div className="menu-item px-4 py-1.5">
          <button type="button" onClick={logout} className="btn btn-sm btn-light justify-center w-full">
            <FormattedMessage id="USER.MENU.LOGOUT" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <MenuSub
      className="menu-default light:border-gray-300 w-[200px] md:w-[250px]"
      rootClassName="p-0"
    >
      {buildHeader()}
      {buildMenu()}
      {buildFooter()}
    </MenuSub>
  );
};

export { DropdownUser };
