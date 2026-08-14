import React from 'react';

type Requisition = {
  id: string;
  description: string;
  amount: string;
  status: 'Pending' | 'Approved' | 'Accountability';
};

const requisitions: Requisition[] = [
  {
    id: 'REQ-001',
    description: 'Training Workshop',
    amount: 'UGX 2.4M',
    status: 'Pending',
  },
  {
    id: 'REQ-002',
    description: 'Transport',
    amount: 'UGX 1.2M',
    status: 'Approved',
  },
  {
    id: 'REQ-003',
    description: 'Office Supplies',
    amount: 'UGX 800K',
    status: 'Accountability',
  },
];

const RecentRequisitions = () => {
  return (
    <div className="card h-full">
      {/* Header */}
      <div className="card-header">
        <h3 className="card-title">Recent Requisitions</h3>

        <div className="card-toolbar">
          <button className="btn btn-sm btn-light-primary">
            View All
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
            <thead>
              <tr className="fw-bold text-muted">
                <th className="min-w-120px ps-6">Requisition</th>
                <th className="min-w-200px">Description</th>
                <th className="min-w-120px">Amount</th>
                <th className="min-w-120px">Status</th>
              </tr>
            </thead>

            <tbody>
              {requisitions.map((requisition) => (
                <tr key={requisition.id}>
                  <td className="ps-6">
                    <span className="text-gray-900 fw-bold">
                      {requisition.id}
                    </span>
                  </td>

                  <td>
                    <span className="text-gray-900 fw-semibold">
                      {requisition.description}
                    </span>
                  </td>

                  <td>
                    <span className="text-gray-900 fw-bold">
                      {requisition.amount}
                    </span>
                  </td>

                  <td>
                    <StatusBadge status={requisition.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StatusBadge = ({
  status,
}: {
  status: Requisition['status'];
}) => {
  const styles = {
    Pending: 'badge-light-warning',
    Approved: 'badge-light-success',
    Accountability: 'badge-light-info',
  };

  return (
    <span className={`badge ${styles[status]} fw-semibold px-4 py-3`}>
      {status}
    </span>
  );
};

export default RecentRequisitions;