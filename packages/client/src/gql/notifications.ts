import { gql } from '@apollo/client';

export type NotificationEntityType = 'Program' | 'Requisition' | 'Accountability';

export type NotificationRecord = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string | null;
  entityType: NotificationEntityType | null;
  entityId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

export const GET_NOTIFICATIONS = gql`
  query Notifications($limit: Int, $offset: Int, $unreadOnly: Boolean) {
    notifications(limit: $limit, offset: $offset, unreadOnly: $unreadOnly) {
      id
      userId
      type
      title
      message
      entityType
      entityId
      isRead
      readAt
      createdAt
    }
  }
`;

export const GET_UNREAD_NOTIFICATIONS_COUNT = gql`
  query UnreadNotificationsCount {
    unreadNotificationsCount
  }
`;

export const MARK_NOTIFICATION_READ = gql`
  mutation MarkNotificationRead($id: ID!) {
    markNotificationRead(id: $id) {
      id
      isRead
      readAt
    }
  }
`;

export const MARK_ALL_NOTIFICATIONS_READ = gql`
  mutation MarkAllNotificationsRead {
    markAllNotificationsRead
  }
`;
