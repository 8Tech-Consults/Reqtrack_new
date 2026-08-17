import { gql } from "@apollo/client";

const LOAD_USERS = gql`
  query Users(
    $limit: Int
    $offset: Int
    $search: String
    $roleName: String
    $district: String
  ) {
    users(
      limit: $limit
      offset: $offset
      search: $search
      roleName: $roleName
      district: $district
    ) {
      id
      username
      name
      # staff_number
      phone_number
      email
      district
      image
      role_id
      role_name
      created_at
      updated_at
      must_change_password
      staffDetails {
        signature
        role_name
      }
    }
    usersCount(search: $search, roleName: $roleName, district: $district)
  }
`;

const ROLES = gql`
  query Roles {
    roles {
      id
      name
      description
      permissions
    }
  }
`;

const DISTRICTS = gql`
  query Districts {
    districts {
      id
      name
      created_at
      updated_at
    }
  }
`;

const DISABILITIES = gql`
  query Disabilities {
  disabilities {
    id
    name
    created_at
    updated_at
    photo_id
    description
  }
}
`;

const ME = gql`
query Me {
  me {
    id
    username
    name
    # staff_number
    email
    district
    phone_number
    image
    role_id
    role_name
    must_change_password
    created_at
    updated_at
  }
}
`;

 export { LOAD_USERS,ROLES, DISTRICTS, DISABILITIES, ME };
