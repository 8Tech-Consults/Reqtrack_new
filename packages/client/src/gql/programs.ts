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
      type
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
        type
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
  type: 'Activity' | 'Admin';
  createdAt: string;
  outcomes: ProgramOutcome[];
};

export const UPLOAD_PROGRAM_BUDGET = gql`
  mutation UploadProgramBudget($programId: ID!, $file: Upload!) {
    uploadProgramBudget(programId: $programId, file: $file) {
      success
      message
      createdBudgetLines
      errors
    }
  }
`;

export type ProgramBudgetUploadResult = {
  success: boolean;
  message: string;
  createdBudgetLines?: number | null;
  errors?: string[] | null;
};

export const CREATE_PROGRAM_BUDGET_LINE = gql`
  mutation CreateProgramBudgetLine($input: CreateProgramBudgetLineInput!) {
    createProgramBudgetLine(input: $input) {
      success
      message
      budgetLine {
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
`;

export type CreateProgramBudgetLineResult = {
  success: boolean;
  message: string;
  budgetLine?: ProgramBudgetLine | null;
};