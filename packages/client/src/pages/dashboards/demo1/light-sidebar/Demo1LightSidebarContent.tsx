import { Contributions, MediaUploads } from '@/pages/public-profile/profiles/default';
import {
  ChannelStats,
  EarningsChart,
  EntryCallout,
  Highlights,
  TeamMeeting,
  Teams
} from './blocks';
import { useQuery } from '@apollo/client/react';
import { MONTHLYREQUISITIONEXPENSE, REQUISITIONSTATUSCHART } from '@/gql/dashboard';
import RecentRequisitions from '../../RecentRequisition';

const Demo1LightSidebarContent = () => {
  const { data } = useQuery<{
    requisitionStatusChart: import('@/pages/public-profile/profiles/default/blocks/Contributions').RequisitionStatusChart;
  }>(REQUISITIONSTATUSCHART);
  const statusData = data;

  //monthly requisition expenses
  const { data: ExpenseData } = useQuery<{
    yearExpense: Array<{ month: number; totalAmount: number }>;
  }, { year: number }>(MONTHLYREQUISITIONEXPENSE, {
    variables: {
      "year": 2026
    },
    fetchPolicy: 'network-only',
  });
// console.log('data.............', ExpenseData)
  
  return (
    <div className="grid gap-5 lg:gap-7.5">
      {/* <div className="grid lg:grid-cols-3 gap-y-5 lg:gap-7.5 items-stretch"> */}
        {/* <div className="lg:col-span-1"> */}
          <div className="grid grid-cols-4 gap-5 lg:gap-7.5 h-full items-stretch">
            <ChannelStats />
          </div>
        {/* </div> */}

        {/* <div className="lg:col-span-2">
          <EntryCallout className="h-full" />
        </div> */}
      {/* </div> */}

      <div className="grid lg:grid-cols-3 gap-5 lg:gap-7.5 items-stretch">
        <div className="lg:col-span-1">
          <Contributions title="Fund Request Status Overview" statusData= {statusData} />
        </div>

        <div className="lg:col-span-2">
          {/* <EarningsChart /> */}
          <MediaUploads ExpenseData={ExpenseData}/>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 lg:gap-7.5 items-stretch">
        <div className="lg:col-span-1">
          {/* <TeamMeeting /> */}
          <Highlights limit={3} />
        </div>

        <div className="lg:col-span-2">
          <RecentRequisitions />
        </div>
      </div>
    </div>
  );
};

export { Demo1LightSidebarContent };
