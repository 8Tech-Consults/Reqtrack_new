import { Fragment, useRef, useState } from 'react';
import { Container } from '@/components/container';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
  ToolbarPageTitle,
  ToolbarDescription,
} from '@/partials/toolbar';
import { RequisitionsList } from './blocks/RequisitionsList.tsx';
import { useAuthContext } from '@/auth';
import { getPermissionsFromToken } from '@/utils/permissions.ts';

const RequisitionsListPage = () => {
  const exportFnRef = useRef<(() => void) | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const { auth, currentUser } = useAuthContext();
  const permissions = getPermissionsFromToken(auth?.access_token);
  const canEditRequisitions = Boolean(permissions.can_edit_requisitions);

  const handleExportClick = () => {
    if (exportFnRef.current) {
      exportFnRef.current();
    }
  };

  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading>
            <ToolbarPageTitle text="Requisitions" />
            <ToolbarDescription>
              Manage budget requisitions
            </ToolbarDescription>
          </ToolbarHeading>
          <ToolbarActions>
            <button
              type="button"
              className="btn btn-sm btn-light"
              onClick={handleExportClick}
              disabled={exportLoading || !exportFnRef.current}
            >
              Export
            </button>
            {canEditRequisitions && (
              <button
                onClick={() => setCreateOpen(true)}
                className="btn btn-sm btn-primary"
              >
                New Requisition
              </button>
            )}
          </ToolbarActions>
        </Toolbar>
      </Container>

      <Container>
        <RequisitionsList
          createOpen={createOpen}
          onCreateOpenChange={setCreateOpen}
          onExportReady={(fn, state) => {
            exportFnRef.current = fn;
            setExportLoading(state.loading);
          }}
          canEdit={canEditRequisitions}
        />
      </Container>
    </Fragment>
  );
};

export { RequisitionsListPage };
