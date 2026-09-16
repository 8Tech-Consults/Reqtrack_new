import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client/react';
import { formatDistanceToNowStrict } from 'date-fns';
import { CheckCheck, Inbox, X } from 'lucide-react';
import { MenuSub } from '@/components/menu';
import {
  GET_NOTIFICATIONS,
  MARK_ALL_NOTIFICATIONS_READ,
  MARK_NOTIFICATION_READ,
  GET_UNREAD_NOTIFICATIONS_COUNT,
  type NotificationRecord,
} from '@/gql/notifications';
import { getNotificationPath } from '@/utils/notificationLink';
import { formatDate } from '@/pages/staff/blocks/StaffList';

const RECENT_LIMIT = 8;

interface IDropdownNotificationProps {
  menuTtemRef: any;
}

const DropdownNotifications = ({ menuTtemRef }: IDropdownNotificationProps) => {
  const navigate = useNavigate();

  const handleClose = () => {
    if (menuTtemRef.current) {
      menuTtemRef.current.hide();
    }
  };

  const { data, loading, refetch } = useQuery<{ notifications: NotificationRecord[] }>(
    GET_NOTIFICATIONS,
    { variables: { limit: RECENT_LIMIT }, fetchPolicy: 'cache-and-network' }
  );
  const notifications = data?.notifications || [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const [markRead] = useMutation(MARK_NOTIFICATION_READ, {
    refetchQueries: [{ query: GET_UNREAD_NOTIFICATIONS_COUNT }],
  });
  const [markAllRead] = useMutation(MARK_ALL_NOTIFICATIONS_READ, {
    refetchQueries: [{ query: GET_UNREAD_NOTIFICATIONS_COUNT }],
    onCompleted: () => refetch(),
  });

  const handleItemClick = async (notification: NotificationRecord) => {
    if (!notification.isRead) {
      try {
        await markRead({ variables: { id: notification.id } });
        refetch();
      } catch {
        // Navigation shouldn't be blocked by a failed read-receipt.
      }
    }

    const path = getNotificationPath(notification.entityType, notification.entityId);
    handleClose();
    if (path) navigate(path);
  };

  return (
    <MenuSub rootClassName="w-full max-w-[420px]" className="light:border-gray-300">
      <div className="flex items-center justify-between gap-2.5 text-sm text-gray-900 font-semibold px-5 py-2.5 border-b border-b-gray-200">
        <span>
          Notifications
          {unreadCount > 0 && (
            <span className="ml-2 rounded-full bg-primary-light px-2 py-0.5 text-xs font-semibold text-primary">
              {unreadCount} new
            </span>
          )}
        </span>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              type="button"
              className="btn btn-sm btn-icon btn-light btn-clear shrink-0"
              onClick={() => markAllRead()}
              title="Mark all as read"
            >
              <CheckCheck className="size-4" />
            </button>
          )}
          <button className="btn btn-sm btn-icon btn-light btn-clear shrink-0" onClick={handleClose}>
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="max-h-[420px] overflow-y-auto">
        {loading && !notifications.length ? (
          <div className="px-5 py-8 text-center text-sm text-gray-500">Loading...</div>
        ) : !notifications.length ? (
          <div className="flex flex-col items-center gap-2 px-5 py-10 text-center text-sm text-gray-500">
            <Inbox className="size-6 text-gray-400" />
            You're all caught up.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <button
                  type="button"
                  onClick={() => handleItemClick(notification)}
                  className={`flex w-full items-start gap-2 px-5 py-3 text-left transition-colors hover:bg-gray-50 ${
                    notification.isRead ? '' : 'bg-primary-light/40'
                  }`}
                >
                  {!notification.isRead && (
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                  )}
                  <span className={notification.isRead ? 'ml-4 min-w-0 flex-1' : 'min-w-0 flex-1'}>
                    <span className="block text-sm font-medium text-gray-900">{notification.title}</span>
                    {notification.message && (
                      <span className="mt-0.5 block text-xs text-gray-500 line-clamp-2">
                        {notification.message}
                      </span>
                    )}
                    <span className="mt-1 block text-[11px] text-gray-400">
                      {/* {formatDistanceToNowStrict(new Date(notification.createdAt), { addSuffix: true })} */}
                      {formatDate(notification.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </MenuSub>
  );
};

export { DropdownNotifications };
