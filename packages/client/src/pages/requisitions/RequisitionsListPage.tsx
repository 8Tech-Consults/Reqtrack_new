import { useCallback, useEffect, useRef, useState } from 'react';
import { Container } from '@/components/container';
import { RequisitionsList } from './blocks/RequisitionsList.tsx';
import { useAuthContext } from '@/auth';
import { getPermissionsFromToken } from '@/utils/permissions.ts';
import { useDemo8Layout } from '@/layouts/demo8';

const RequisitionsListPage = () => {
  const exportFnRef = useRef<(() => void) | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const { setPageActions } = useDemo8Layout();

  const { auth } = useAuthContext();
  const perms = getPermissionsFromToken(auth?.access_token);
  const canEditRequisitions = Boolean(perms.can_edit_requisitions);

  const canCreateRequisitions = !!perms['can_create_requisitions'];
  const canAddBudgetLines = !!perms['can_add_budget_lines'];

  const handleExportClick = useCallback(() => {
    if (exportFnRef.current) {
      exportFnRef.current();
    }
  }, []);

  const handleCreateClick = useCallback(() => setCreateOpen(true), []);

  useEffect(() => {
    setPageActions([
      {
        label: 'Export',
        onClick: handleExportClick,
        variant: 'secondary',
        icon: 'download',
        disabled: exportLoading,
      },
      ...(canCreateRequisitions
        ? [{ label: 'New Requisition', onClick: handleCreateClick, icon: 'plus' as const }]
        : []),
    ]);

    return () => setPageActions([]);
  }, [canCreateRequisitions, exportLoading, handleCreateClick, handleExportClick, setPageActions]);

  return (
    <Container>
      <div className="py-4 sm:py-5 lg:py-6">
        <RequisitionsList
          createOpen={createOpen}
          onCreateOpenChange={setCreateOpen}
          onExportReady={(fn, state) => {
            exportFnRef.current = fn;
            setExportLoading(state.loading);
          }}
          canEdit={canEditRequisitions}
          canAddBudgetLines={canAddBudgetLines}
        />
      </div>
    </Container>
  );
};

export { RequisitionsListPage };
