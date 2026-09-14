const notificationsTypeDefs = `#graphql

  enum NotificationEntityType {
    Program
    Requisition
    Accountability
  }

  type Notification {
    id: ID!
    userId: ID!
    type: String!
    title: String!
    message: String
    entityType: NotificationEntityType
    entityId: ID
    isRead: Boolean!
    readAt: String
    createdAt: String!
  }

  extend type Query {
    "Notifications for the current user, newest first."
    notifications(limit: Int, offset: Int, unreadOnly: Boolean): [Notification!]!
    unreadNotificationsCount: Int!
  }

  extend type Mutation {
    markNotificationRead(id: ID!): Notification!
    markAllNotificationsRead: Boolean!
  }
`;

export default notificationsTypeDefs;
