import { Fragment, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@apollo/client/react';
import { ArrowLeft } from 'lucide-react';
import { Container } from '@/components/container';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
  ToolbarPageTitle,
  ToolbarDescription,
} from '@/partials/toolbar';
import { GET_REQUISITIONS } from '@/gql/requisitions';
import { RequisitionRecord } from './blocks/RequisitionsList';
import { AccountabilitySection } from '@/pages/accountabilities/AccountabilitiesPage';
import { URL_2 } from '@/config/urls';

const AccountabilityPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, loading, error } = useQuery<{ requisitions: RequisitionRecord[] }>(GET_REQUISITIONS, {
    variables: { limit: 500, offset: 0 },
    fetchPolicy: 'cache-and-network',
  });

  const requisition = useMemo(
    () => (data?.requisitions || []).find((r) => r.id === id) || null,
    [data, id]
  );

  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading>
            <ToolbarPageTitle text={requisition ? `Accountability — ${requisition.requisitionNo}` : 'Accountability'} />
            <ToolbarDescription>
              {requisition?.title || 'Manage accountability for this requisition'}
            </ToolbarDescription>
          </ToolbarHeading>
          <ToolbarActions>
            <button
              type="button"
              className="btn btn-sm btn-light"
              onClick={() => navigate('/requisitions')}
            >
              <ArrowLeft size={14} />
              Back to Requisitions
            </button>
          </ToolbarActions>
        </Toolbar>
      </Container>

      <Container>
        <div className="bg-white p-6 rounded shadow">
          {loading && !data ? (
            <p className="text-sm text-slate-400">Loading requisition...</p>
          ) : error ? (
            <p className="text-sm text-red-600">Couldn't load this requisition.</p>
          ) : !requisition ? (
            <p className="text-sm text-slate-500">Requisition not found.</p>
          ) : requisition.status !== 'Approved' ? (
            <p className="text-sm text-slate-500">
              Accountability is only available once this requisition has been approved.
            </p>
          ) : (
            <AccountabilitySection
              requisitionId={requisition.id}
              requisitionItems={requisition.items.map((item) => ({
                id: item.id,
                description: item.description,
                amount: item.amount,
              }))}
              fileBaseUrl={URL_2}
            />
          )}
        </div>
      </Container>
    </Fragment>
  );
};

export { AccountabilityPage };
