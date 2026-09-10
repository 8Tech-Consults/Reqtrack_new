import { useState } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { format, startOfYear } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Container } from '@/components/container';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useMediaQuery } from '@/hooks';
import { Demo1LightSidebarContent } from './';

const Demo1LightSidebarPage = () => {
  const now = new Date();
  const compactCalendar = useMediaQuery('(max-width: 639px)');
  const [date, setDate] = useState<DateRange | undefined>({ from: startOfYear(now), to: now });

  const dateLabel = date?.from
    ? date.to
      ? `${format(date.from, 'MMM d, yyyy')} – ${format(date.to, 'MMM d, yyyy')}`
      : format(date.from, 'MMM d, yyyy')
    : 'Choose date range';

  return (
    <>
      {/* <Container>
        <div className="flex flex-col gap-5 pb-6 pt-3 sm:flex-row sm:items-end sm:justify-between lg:pb-8 lg:pt-5">
          <h1 className="text-3xl font-bold tracking-[-0.04em] text-[#172550] sm:text-4xl">Dashboard</h1>

          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="ease-premium inline-flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-[0_5px_18px_rgba(15,35,72,0.05)] outline-none transition-[border-color,box-shadow,transform] duration-150 hover:border-[#9bdcec] focus-visible:ring-2 focus-visible:ring-[#2aaed3] active:scale-[0.98] sm:w-auto">
                <CalendarDays className="size-4 text-[#2aaed3]" aria-hidden="true" />
                <span className="truncate">{dateLabel}</span>
                <ChevronDown className="size-3.5 text-slate-400" aria-hidden="true" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto rounded-xl border-slate-200 bg-white p-0 shadow-[0_18px_50px_rgba(16,35,72,0.18)]" align="end">
              <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={compactCalendar ? 1 : 2} />
            </PopoverContent>
          </Popover>
        </div>
      </Container> */}

      <Container>
        <Demo1LightSidebarContent />
      </Container>
    </>
  );
};

export { Demo1LightSidebarPage };
