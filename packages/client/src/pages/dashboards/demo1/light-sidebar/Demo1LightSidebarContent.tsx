import { useQuery } from '@apollo/client/react';
import { MONTHLYREQUISITIONEXPENSE, REQUISITIONSTATUSCHART } from '@/gql/dashboard';
import RecentRequisitions from '../../RecentRequisition';
import { ChannelStats, DashboardStatusChart, DisbursementChart, Highlights } from './blocks';
import type { RequisitionStatusChart } from './blocks';

const DashboardSectionHeading = ({ id, title }: { id: string; title: string }) => (
  <h2 id={id} className="text-xl font-bold tracking-[-0.025em] text-[#172550]">{title}</h2>
);

const Demo1LightSidebarContent = () => {
  const year = new Date().getFullYear();
  const statusQuery = useQuery<{ requisitionStatusChart: RequisitionStatusChart }>(REQUISITIONSTATUSCHART);
  const expenseQuery = useQuery<{ yearExpense: Array<{ month: number; totalAmount: number }> }, { year: number }>(
    MONTHLYREQUISITIONEXPENSE,
    { variables: { year }, fetchPolicy: 'network-only' }
  );

  return (
    <div className="space-y-7 lg:space-y-9">
      <section aria-labelledby="overview-heading">
        <DashboardSectionHeading id="overview-heading" title="Overview" />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ChannelStats />
        </div>
      </section>

      <section aria-labelledby="analytics-heading">
        <DashboardSectionHeading id="analytics-heading" title="Analytics" />
        <div className="mt-4 grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <DashboardStatusChart data={statusQuery.data?.requisitionStatusChart} loading={statusQuery.loading} error={statusQuery.error} />
          <DisbursementChart expenseData={expenseQuery.data?.yearExpense} loading={expenseQuery.loading} error={expenseQuery.error} year={year} />
        </div>
      </section>

      <section aria-labelledby="activity-heading">
        <DashboardSectionHeading id="activity-heading" title="Recent activity" />
        <div className="mt-4 grid items-stretch gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
          <Highlights limit={3} />
          <RecentRequisitions />
        </div>
      </section>
    </div>
  );
};

export { Demo1LightSidebarContent };
