import { Fragment } from 'react';

import { toAbsoluteUrl } from '@/utils/Assets';
import { useQuery } from '@apollo/client/react';
import { REQUISITIONSTATISSUMMARY } from '@/gql/dashboard';
import { KeenIcon } from '@/components';

interface IChannelStatsItem {
  icon: string;
  color: 'warning' | 'info' | 'primary' | 'success';
  info: string;
  desc: string;
  path: string;
}
interface IChannelStatsItems extends Array<IChannelStatsItem> {}

const ChannelStats = () => {
  const { data, loading, error } = useQuery<{
    requisitionStatusSummary: {
      pendingRequisitions: number;
      directorRequisitions: number;
      pendingAccountabilityNames: string[];
      totalAmountRequestedFormatted: string;
    };
  }>(REQUISITIONSTATISSUMMARY);

  const summary = data?.requisitionStatusSummary;

  const items: IChannelStatsItems = [
    {
      icon: 'dollar',
      color: 'warning',
      info: loading ? '—' : String(summary?.pendingRequisitions ?? 0),
      desc: 'Requisitions pending Finance approval',
      path: '',
    },
    {
      icon: 'verify',
      color: 'info',
      info: loading ? '—' : String(summary?.directorRequisitions ?? 0),
      desc: `Requisitions pending Director's approval`,
      path: '',
    },
    {
      icon: 'document',
      color: 'primary',
      info: loading ? '—' : String(summary?.pendingAccountabilityNames?.length ?? 0),
      desc: 'Pending Accountabilities',
      path: '',
    },
    {
      icon: 'wallet',
      color: 'success',
      info: loading ? '—' : (summary?.totalAmountRequestedFormatted ?? '0'),
      desc: 'Total Funds Disbursed this year',
      path: '',
    },
  ];

  const renderItem = (item: IChannelStatsItem, index: number) => {
    return (
      <div
        key={index}
        // className="card flex-col justify-between gap-6 h-full bg-cover rtl:bg-[left_top_-1.7rem] bg-[right_top_-1.7rem] bg-no-repeat channel-stats-bg"
        className="card flex-col justify-between gap-6 h-full bg-cover "
      >
        <div className={`flex items-center justify-center rounded-full size-11 mt-4 ms-5 bg-${item.color}-light`}>
          <KeenIcon icon={item.icon} className={`text-${item.color} text-xl`} />
        </div>

        <div className="flex flex-col gap-1 pb-4 px-5">
          <span className="text-3xl font-semibold text-gray-900">{item.info}</span>
          <span className="text-2sm font-normal text-gray-700">{item.desc}</span>
        </div>
      </div>
    );
  };

  if (error) {
    return <p className="text-sm text-red-600">Couldn't load dashboard stats. {error.message}</p>;
  }

  return (
    <Fragment>
      <style>
        {`
          .channel-stats-bg {
            background-image: url('${toAbsoluteUrl('/media/images/2600x1600/bg-3.png')}');
          }
          .dark .channel-stats-bg {
            background-image: url('${toAbsoluteUrl('/media/images/2600x1600/bg-3-dark.png')}');
          }
        `}
      </style>

      {items.map((item, index) => renderItem(item, index))}
    </Fragment>
  );
};

export { ChannelStats, type IChannelStatsItem, type IChannelStatsItems };
