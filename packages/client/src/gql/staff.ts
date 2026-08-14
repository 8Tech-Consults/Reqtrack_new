import { gql } from "@apollo/client";


export const GET_STAFF = gql`
query GetStaffs {
  getStaffs {
    id
    user_id
    name
    role_name
    staff_number
    nin_number
    date_of_birth
    title
    contract_start
    contract_end
    telephone
    email
    bank
    bank_account
    tin
    nssf
    marital_status
    next_of_kin
    profile_picture
    signature
  }
}
`;

export const SAVE_STAFF = gql`
mutation SaveStaff($input: StaffInput!) {
  saveStaff(input: $input) {
    id
    user_id
    name
    role_name
    staff_number
    nin_number
    date_of_birth
    title
    contract_start
    contract_end
    telephone
    email
    bank
    bank_account
    tin
    nssf
    marital_status
    next_of_kin
    profile_picture
    signature
  }
}
`;