import type { NotificationEntityType } from '@/gql/notifications';

/**
 * Where clicking a notification should take the user.
 *
 * Requisitions and Programs don't have their own detail routes (they open in
 * a sheet/panel from their list page), so we navigate to the list with a
 * query param the list page picks up on mount to open the right row/sheet.
 * Accountability is the one entity with a real route of its own - note its
 * entityId is the *requisition* id, not the accountability record's id,
 * since that's the only route that exists (/requisitions/:id/accountability).
 */
export function getNotificationPath(
  entityType: NotificationEntityType | null,
  entityId: string | null
): string | null {
  if (!entityType || !entityId) return null;

  switch (entityType) {
    case 'Requisition':
      return `/requisitions?open=${encodeURIComponent(entityId)}`;
    case 'Accountability':
      return `/requisitions/${encodeURIComponent(entityId)}/accountability`;
    case 'Program':
      return `/projects?program=${encodeURIComponent(entityId)}`;
    default:
      return null;
  }
}
