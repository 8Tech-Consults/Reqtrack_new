import { KeenIcon, Menu, MenuItem, MenuToggle } from '@/components';
import { useLanguage } from '@/i18n';
import { DropdownCard1 } from '@/partials/dropdowns/general';
import { useQuery } from '@apollo/client/react';
import { ACCOUNTABILITY_HIGHLIGHTS } from '@/gql/dashboard';

interface IHighlightsProps {
  limit?: number;
}

const currency = (n: number) =>
  new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(n);

const statusLegend = [
  { badgeColor: 'badge-success', label: 'Closed', barColor: 'bg-success' },
  { badgeColor: 'badge-warning', label: 'Pending', barColor: 'bg-warning' },
  { badgeColor: 'badge-danger', label: 'Halted', barColor: 'bg-danger' },
];

interface AccountabilityHighlightsData {
  accountabilityHighlights: {
    totalAccountedAmountFormatted: string;
    percentChange: number | null;
    statusBreakdown: {
      closedPercent: number;
      pendingPercent: number;
      haltedPercent: number;
    };
    recent: Array<{
      requisitionNo: string;
      totalAccountedAmount: number;
      overBudget: boolean;
    }>;
  };
}

const Highlights = ({ limit = 5 }: IHighlightsProps) => {
  const { isRTL } = useLanguage();
  const { data, loading, error } = useQuery<AccountabilityHighlightsData, { limit: number }>(
    ACCOUNTABILITY_HIGHLIGHTS,
    { variables: { limit } }
  );

  const highlights = data?.accountabilityHighlights;
  const breakdown = highlights?.statusBreakdown;

  const renderRow = (row: NonNullable<typeof highlights>['recent'][number], index: number) => {
    return (
      <div key={index} className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <KeenIcon icon="document" className="text-base text-gray-500" />
          <span className="text-sm font-normal text-gray-900">{row.requisitionNo}</span>
        </div>

        <div className="flex items-center text-sm font-medium text-gray-800 gap-6">
          <span className="lg:text-right">{currency(row.totalAccountedAmount)}</span>
          <span className="lg:text-right flex items-center">
            {row.overBudget ? (
              <KeenIcon icon="arrow-up" className="text-danger" />
            ) : (
              <KeenIcon icon="check" className="text-success" />
            )}
            &nbsp;{row.overBudget ? 'Over budget' : 'Within budget'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="card h-full">
      <div className="card-header">
        <h3 className="card-title">Accountability Highlights</h3>

        <Menu>
          <MenuItem
            toggle="dropdown"
            trigger="click"
            dropdownProps={{
              placement: isRTL() ? 'bottom-start' : 'bottom-end',
              modifiers: [
                {
                  name: 'offset',
                  options: {
                    offset: isRTL() ? [0, -10] : [0, 10]
                  }
                }
              ]
            }}
          >
            <MenuToggle className="btn btn-sm btn-icon btn-light btn-clear">
              <KeenIcon icon="dots-vertical" />
            </MenuToggle>
            {DropdownCard1()}
          </MenuItem>
        </Menu>
      </div>

      <div className="card-body flex flex-col gap-4 p-5 lg:p-7.5 lg:pt-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-normal text-gray-700">All time accounted</span>

          <div className="flex items-center gap-2.5">
            <span className="text-3xl font-semibold text-gray-900">
              {loading ? '—' : highlights?.totalAccountedAmountFormatted ?? '0'}
            </span>
            {highlights?.percentChange != null && (
              <span
                className={`badge badge-outline badge-sm ${highlights.percentChange >= 0 ? 'badge-success' : 'badge-danger'}`}
              >
                {highlights.percentChange >= 0 ? '+' : ''}{highlights.percentChange}%
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 mb-1.5">
          <div
            className="bg-success h-2 rounded-sm"
            style={{ width: `${breakdown?.closedPercent ?? 0}%` }}
          />
          <div
            className="bg-warning h-2 rounded-sm"
            style={{ width: `${breakdown?.pendingPercent ?? 0}%` }}
          />
          <div
            className="bg-danger h-2 rounded-sm"
            style={{ width: `${breakdown?.haltedPercent ?? 0}%` }}
          />
        </div>

        <div className="flex items-center flex-wrap gap-4 mb-1">
          {statusLegend.map((item, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <span className={`badge badge-dot size-2 ${item.badgeColor}`}></span>
              <span className="text-sm font-normal text-gray-800">{item.label}</span>
            </div>
          ))}
        </div>

        <div className="border-b border-gray-300"></div>

        {error && <p className="text-sm text-red-600">Couldn't load accountability highlights.</p>}

        <div className="grid gap-3">
          {highlights?.recent.slice(0, limit).map(renderRow)}
        </div>
      </div>
    </div>
  );
};

export { Highlights, type IHighlightsProps };
