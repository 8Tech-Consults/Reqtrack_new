const staffTypeDefs = `#graphql
    scalar DateTime
    scalar Upload
    scalar JSON

    type Staff {
        id: ID
        user_id: ID
        name: String!
        role_name: String!
        staff_number: String!
        nin_number: String!
        date_of_birth: String!
        title:String!
        contract_start: String!
        contract_end:String!
        telephone: String!
        email: String!
        bank:String!
        bank_account: String!
        tin: String!
        nssf: String!
        marital_status: String!
        next_of_kin: JSON!
        profile_picture: String
        signature: String

    }

    input StaffInput {
        id: ID
        user_id: ID
        name: String!
        role_name: String!
        staff_number: String!
        nin_number: String!
        date_of_birth: String!
        title:String!
        contract_start: String!
        contract_end:String!
        telephone: String!
        email: String!
        bank:String!
        bank_account: String!
        tin: String!
        nssf: String!
        marital_status: String!
        next_of_kin: String!
        profile_picture: Upload
        signature: Upload
    }

    type Query {
        getStaffs: [Staff]
        getStaffById(id: ID!): Staff
    }

    type Mutation {
        saveStaff(input: StaffInput!): Staff
        deleteStaff(id: ID!): Boolean
    }

`;

export default staffTypeDefs;