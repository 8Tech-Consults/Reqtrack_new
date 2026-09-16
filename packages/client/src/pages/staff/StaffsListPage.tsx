import { useCallback, useEffect, useState } from 'react';
import { Container } from '@/components/container';
import { StaffList } from './blocks/StaffList.tsx';
import { useAuthContext } from '@/auth';
import { getPermissionsFromToken } from '@/utils/permissions.ts';
import { useDemo8Layout } from '@/layouts/demo8';

const StaffsListPage = () => {
  const [createOpen, setCreateOpen] = useState(false);
  const { setPageActions } = useDemo8Layout();

  const { auth } = useAuthContext();
  const permissions = getPermissionsFromToken(auth?.access_token);
  const canManageStaff = Boolean(permissions.can_manage_staff);
  const canCreateStaff = canManageStaff || Boolean(permissions.can_create_staff);
  const canEditStaff = canManageStaff || Boolean(permissions.can_edit_staff);
  const handleCreateStaff = useCallback(() => setCreateOpen(true), []);

  useEffect(() => {
    setPageActions(
      canCreateStaff
        ? [{ label: 'New Staff', onClick: handleCreateStaff, icon: 'plus' }]
        : []
    );

    return () => setPageActions([]);
  }, [canCreateStaff, handleCreateStaff, setPageActions]);

  return (
    <Container>
      <div className="py-4 sm:py-5 lg:py-6">
        <StaffList
          createOpen={createOpen}
          onCreateOpenChange={setCreateOpen}
          canEdit={canEditStaff}
        />
      </div>
    </Container>
  );
};

export { StaffsListPage };
