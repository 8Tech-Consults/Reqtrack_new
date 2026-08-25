import { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { AccountabilityForm } from './components/AccountabilityForm.tsx';
import { AccountabilityDetail } from './components/AccountabilityDetail.tsx';
import { GET_ACCOUNTABILITIES } from '@/gql/accountabilities';
import { FileText } from 'lucide-react';

interface RequisitionItemOption {
  id: string;
  description: string;
  amount: number;
}

interface Props {
  requisitionId: string;
  requisitionItems: RequisitionItemOption[];
  fileBaseUrl: string;
}

type Mode = 'view' | 'create' | 'edit';

export function AccountabilitySection({ requisitionId, requisitionItems, fileBaseUrl }: Props) {
  const [mode, setMode] = useState<Mode>('view');

  const { data, loading, error, refetch } = useQuery(GET_ACCOUNTABILITIES, {
    variables: { requisitionId, limit: 1 },
  });

  const accountability = data?.accountabilities?.[0] ?? null;

  if (loading) return <p className="text-sm text-slate-400">Loading accountability...</p>;
  if (error) return <p className="text-sm text-red-600">Couldn't load accountability. {error.message}</p>;

  // No accountability yet — prompt to create one
  if (!accountability && mode === 'view') {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 p-6 text-center">
        <FileText className="text-slate-400" size={24} />
        <p className="text-sm text-slate-500">No accountability has been submitted for this requisition yet.</p>
        <button
          onClick={() => setMode('create')}
          className="mt-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Submit Accountability
        </button>
      </div>
    );
  }

  if (mode === 'create' || mode === 'edit') {
    return (
      <AccountabilityForm
        requisitionId={requisitionId}
        requisitionItems={requisitionItems}
        existing={mode === 'edit' ? accountability : null}
        onSaved={() => { setMode('view'); refetch(); }}
        onCancel={() => setMode('view')}
      />
    );
  }

  // mode === 'view' and accountability exists
  return (
    <AccountabilityDetail
      id={accountability!.id}
      fileBaseUrl={fileBaseUrl}
      onBack={() => {}}          // no "back" needed — it's embedded in the requisition page
      onEdit={() => setMode('edit')}
    />
  );
}
