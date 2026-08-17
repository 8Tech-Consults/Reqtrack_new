import { gql } from '@apollo/client';

export const GET_PROGRAMS = gql`
  query Programs {
    programs {
      id
      name
      description
      budgetAmount
      programManagerId
      programManagerName
      status
      createdAt
      outcomes {
        id
        name
        sortOrder
        outputs {
          id
          name
          sortOrder
          activities {
            id
            name
            sortOrder
            budgetLines {
              id
              name
              quantity
              frequency
              unitPrice
              units
              totalAmount
              sortOrder
            }
          }
        }
      }
    }
  }
`;

export const GET_PROGRAM_MANAGERS = gql`
  query ProgramManagers {
    programManagers {
      id
      name
      role
    }
  }
`;

export const CREATE_PROGRAM = gql`
  mutation CreateProgram($input: ProgramInput!) {
    createProgram(input: $input) {
      success
      message
      program {
        id
        name
        description
        budgetAmount
        programManagerId
        programManagerName
        status
        createdAt
      }
    }
  }
`;

export const DELETE_PROGRAM = gql`
  mutation DeleteProgram($id: ID!) {
    deleteProgram(id: $id) {
      success
      message
    }
  }
`;

export const SAVE_PROGRAM_STRUCTURE = gql`
  mutation SaveProgramStructure($input: SaveProgramStructureInput!) {
    saveProgramStructure(input: $input) {
      success
      message
    }
  }
`;

export type ProgramManager = {
  id: string;
  name: string;
  role?: string | null;
};

export type ProgramBudgetLine = {
  id: string;
  name: string;
  quantity: number;
  frequency: number;
  unitPrice: number;
  units: string;
  totalAmount: number;
  sortOrder: number;
};

export type ProgramActivity = {
  id: string;
  name: string;
  sortOrder: number;
  budgetLines: ProgramBudgetLine[];
};

export type ProgramOutput = {
  id: string;
  name: string;
  sortOrder: number;
  activities: ProgramActivity[];
};

export type ProgramOutcome = {
  id: string;
  name: string;
  sortOrder: number;
  outputs: ProgramOutput[];
};

export type ProgramRecord = {
  id: string;
  name: string;
  description?: string | null;
  budgetAmount: number;
  programManagerId?: string | null;
  programManagerName?: string | null;
  status: string;
  createdAt: string;
  outcomes: ProgramOutcome[];
};