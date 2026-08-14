const userTypeDefs = `#graphql
    scalar DateTime
    scalar Upload

    type User {
        id: ID!
        username: String!
        name: String!
        # staff_number: String!
        email: String
        district: String!
        phone_number: String
        image: String
        role_id: String
        role_name: String
        status: String
        created_at: DateTime!
        updated_at: DateTime!
        must_change_password: Boolean
        
    }


    input CreateUserInput {
        id: ID,
        username: String!
        name: String!
        # company_initials: String!
        email: String!
        district: String!
        premises_location: String!
        phone_number: String
        password: String
        image: Upload,
        role_id: String
        status: String
    }

     input RegisterInput {
        username: String!
        name: String!
        # company_initials: String!
        premises_location: String!
        phone_number: String
        password: String!
        email: String
        district: String
    }

    input UpdateUserInput {
        id: ID!
        email: String
        firstName: String
        lastName: String
        isActive: Boolean
        district: String
        subcounty: String
        school_id: String
    }

    input DuAgentInput {
        id: ID
        username: String!
        name: String!
        email: String!
        phone_number: String
        district: String
        premises_location: String
        # company_initials: String
        password: String
    }


    type Query {
        users(limit: Int, offset: Int, search: String, roleName: String, district: String): [User!]!
        usersCount(search: String, roleName: String, district: String): Int!
        user(id: ID!): User
        currentUser: User
        me: User
    }

    type Mutation {
        login(email: String!, password: String!) :UserLoginResponse!
        changeMyPassword(newPassword: String!): UserLoginResponse!
        createUser(payload: CreateUserInput!): UserResponse!
        saveDuAgent(payload: DuAgentInput!): UserResponse!
        register(payload: RegisterInput!): UserResponse!
        updateUser(payload: UpdateUserInput!): UserResponse!
        toggleUserStatus(id: ID!): UserResponse!
        requestPasswordResetLink(email: String!): UserResponse!
        resetPassword(id: String!, newPassword: String!): UserResponse!
        resetPasswordWithToken(token: String!, newPassword: String!): UserResponse!
        deleteUser(user_id: String!): UserResponse
        deleteDuAgent(user_id: String!): UserResponse
        deleteAccount(password: String!): UserResponse!
    }
`;

export default userTypeDefs;
