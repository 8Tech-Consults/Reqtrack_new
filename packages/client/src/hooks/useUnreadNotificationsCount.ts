import { useQuery } from '@apollo/client/react';
import { GET_UNREAD_NOTIFICATIONS_COUNT } from '@/gql/notifications';

// Approvers are expected to see a new request within a few seconds of it being raised.
export const NOTIFICATIONS_POLL_INTERVAL_MS = 5000;

/**
 * Polls how many unread notifications the current user has, for badge dots
 * on the notification bell. Shared between the desktop and mobile headers so
 * both stay in sync without duplicating the query.
 */
export function useUnreadNotificationsCount() {
  const { data, refetch } = useQuery<{ unreadNotificationsCount: number }>(
    GET_UNREAD_NOTIFICATIONS_COUNT,
    { pollInterval: NOTIFICATIONS_POLL_INTERVAL_MS, fetchPolicy: 'cache-and-network' }
  );

  return { count: data?.unreadNotificationsCount || 0, refetch };
}
