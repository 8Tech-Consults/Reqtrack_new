import { Fragment, useState } from 'react';
import { Container } from '@/components/container';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
  ToolbarPageTitle,
  ToolbarDescription,
} from '@/partials/toolbar';
import { StaffList } from './blocks/StaffList.tsx';
import { useAuthContext } from '@/auth';
import { getPermissionsFromToken } from '@/utils/permissions.ts';

const StaffsListPage = () => {
  const [createOpen, setCreateOpen] = useState(false);

  const { auth } = useAuthContext();
  const permissions = getPermissionsFromToken(auth?.access_token);
  const canManageStaff = Boolean(permissions.can_manage_staff);
  const canCreateStaff = canManageStaff || Boolean(permissions.can_create_staff);
  const canEditStaff = canManageStaff || Boolean(permissions.can_edit_staff);

  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading>
            <ToolbarPageTitle text="Staff" />
            <ToolbarDescription>
              Manage staff records and employment details
            </ToolbarDescription>
          </ToolbarHeading>
          <ToolbarActions>
            {canCreateStaff && (
              <button
                onClick={() => setCreateOpen(true)}
                className="btn btn-sm btn-primary"
              >
                New Staff
              </button>
            )}
          </ToolbarActions>
        </Toolbar>
      </Container>

      <Container>
        <StaffList
          createOpen={createOpen}
          onCreateOpenChange={setCreateOpen}
          canEdit={canEditStaff}
        />
      </Container>
    </Fragment>
  );
};

export { StaffsListPage };
