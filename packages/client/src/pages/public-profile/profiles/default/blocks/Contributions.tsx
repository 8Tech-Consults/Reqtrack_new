import ApexChart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { useLanguage } from '@/i18n';
import { KeenIcon, Menu, MenuItem, MenuToggle } from '@/components';

import { DropdownCard2 } from '@/partials/dropdowns/general';

interface RequisitionStatusChart {
  pendingCount: number;
  acceptedCount: number;
  approvedCount: number;
  rejectedCount: number;
  requireAmendmentCount: number;
  amendedCount: number;
}

interface IContributionsProps {
  title: string;
  statusData?: { requisitionStatusChart?: RequisitionStatusChart };
}

const Contributions = ({ title, statusData }: IContributionsProps) => {

const summary = statusData?.requisitionStatusChart;

const { isRTL } = useLanguage();

const labels: string[] = ['Pending', 'Accepted', 'Approved', 'Rejected', 'Need amendment', 'Amended'];
const data: number[] = summary
  ? [
      summary.pendingCount,
      summary.acceptedCount,
      summary.approvedCount,
      summary.rejectedCount,
      summary.requireAmendmentCount,
      summary.amendedCount,
    ]
  : [0, 0, 0, 0, 0];
const colors: string[] = [
  'var(--tw-warning)',
  'var(--tw-info)',
  'var(--tw-success)',
  'var(--tw-danger)',
  'var(--tw-brand)',
];

  const options: ApexOptions = {
    series: data,
    labels: labels,
    colors: colors,
    fill: {
      colors: colors
    },
    chart: {
      type: 'donut'
    },
    stroke: {
      show: true,
      width: 2
    },
    dataLabels: {
      enabled: false
    },
    plotOptions: {
      pie: {
        expandOnClick: false
      }
    },
    legend: {
      offsetY: -10,
      offsetX: -10,
      fontSize: '13px',
      fontWeight: '500',
      itemMargin: {
        vertical: 1
      },
      labels: {
        colors: 'var(--tw-gray-700)',
        useSeriesColors: false
      }
    },
    responsive: [
      {
        breakpoint: 480,
        options: {
          chart: {
            width: 400
          },
          legend: {
            position: 'bottom'
          }
        }
      }
    ]
  };

  return (
    <div className="card min-h-[300px]">
      <div className="card-header">
        <h3 className="card-title">{title}</h3>

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
                    offset: isRTL() ? [0, -10] : [0, 10] // [skid, distance]
                  }
                }
              ]
            }}
          >
            <MenuToggle className="btn btn-sm btn-icon btn-light btn-clear">
              <KeenIcon icon="dots-vertical" />
            </MenuToggle>
            {DropdownCard2()}
          </MenuItem>
        </Menu>
      </div>

      <div className="card-body flex justify-center items-center px-3 py-1">
        <ApexChart
          id="contributions_chart"
          options={options}
          series={options.series}
          type="donut"
          width="100%"
          height="480"
        />
      </div>
    </div>
  );
};

export { Contributions, type IContributionsProps, type RequisitionStatusChart };
