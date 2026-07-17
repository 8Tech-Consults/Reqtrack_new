const userTypeDefs = `#graphql
    scalar Date
    scalar JSON
    type Role {
        id: ID!
        name: String!,
        description: String,
        permissions: JSON
    }

    type Query {
        roles: [Role!]!
    }

    type Mutation {
        saveRole(payload: RoleInput!): RoleResponseMessage
        deleteRole(role_id: ID!): ResponseMessage
        updateRolePermissions(payload: RolePermissionInput!): ResponseMessage 
    }

    input RoleInput {
        id: ID
        role_name: String!
        description: String
    }

    input RolePermissionInput {
        role_id: ID!
        permissions: JSON!
    }


    type RoleResponseMessage {
        success: Boolean
        message: String
        data: Role
    }

`;

export default userTypeDefs;
