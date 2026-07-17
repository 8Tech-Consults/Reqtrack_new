import { gql } from "@apollo/client";

const LOGIN = gql`
  mutation Login($username: String!, $password: String!) {
    login(username: $username, password: $password) {
      success
      message
      token
      user {
        id
        username
        name
        staff_number
        email
        district
        phone_number
        image
        role_id
        role_name
        created_at
        updated_at
      }
    }
  }
`;

const SIGNUP = gql`
  mutation CreateUser($payload: CreateUserInput!) {
    createUser(payload: $payload) {
      message
      success
      user {
        id
        username
        name
        staff_number
        phone_number
        email
        district
        image
      }
    }
  }
`;

// Alias for clarity in user management module
const CREATE_USER = SIGNUP;

const DELETE_USER = gql`
  mutation DeleteUser($userId: String!) {
    deleteUser(user_id: $userId) {
      success
      message
    }
  }
`;

const ADD_ROLE = gql`
  mutation SaveRole($payload: RoleInput!) {
    saveRole(payload: $payload) {
      success
      message
    }
  }
`;
const UPDATE_ROLE_PERMISSIONS = gql`
  mutation UpdateRolePermissions($payload: RolePermissionInput!) {
    updateRolePermissions(payload: $payload) {
      success
      message
    }
  }
`;

const DELETE_ROLE = gql`
  mutation DeleteRole($roleId: ID!) {
    deleteRole(role_id: $roleId) {
      success
      message
    }
  }
`;

const CREATE_DISABILITY = gql`
  mutation CreateDisability($payload: DisabilityInput!) {
  createDisability(payload: $payload) {
    success
    message
    disability {
      id
      name
      photo_id
      description
      created_at
      updated_at
    }
  }
}
  `;

const DELETE_DISABILITY = gql`
  mutation DeleteDisability($id: ID!) {
    deleteDisability(id: $id)
  }
`;


export { LOGIN, 
  SIGNUP, 
  CREATE_USER,
  DELETE_USER,
  ADD_ROLE, 
  DELETE_ROLE,
  UPDATE_ROLE_PERMISSIONS,
  CREATE_DISABILITY,
  DELETE_DISABILITY
};