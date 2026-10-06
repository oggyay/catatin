import dayjs from 'dayjs';

export function getPeriodRange(period, tz = 'Asia/Jakarta') {
  const now = dayjs();
  switch (period) {
    case 'today':
      return { from: now.startOf('day').toDate(), to: now.endOf('day').toDate(), label: 'hari ini' };
    case 'yesterday': {
      const y = now.subtract(1, 'day');
      return { from: y.startOf('day').toDate(), to: y.endOf('day').toDate(), label: 'kemarin' };
    }
    case 'this_week':
      return { from: now.startOf('week').toDate(), to: now.endOf('week').toDate(), label: 'minggu ini' };
    case 'last_week': {
      const w = now.subtract(1, 'week');
      return { from: w.startOf('week').toDate(), to: w.endOf('week').toDate(), label: 'minggu lalu' };
    }
    case 'this_month':
      return { from: now.startOf('month').toDate(), to: now.endOf('month').toDate(), label: 'bulan ini' };
    case 'last_month': {
      const m = now.subtract(1, 'month');
      return { from: m.startOf('month').toDate(), to: m.endOf('month').toDate(), label: 'bulan lalu' };
    }
    case 'this_year':
      return { from: now.startOf('year').toDate(), to: now.endOf('year').toDate(), label: 'tahun ini' };
    default:
      return { from: now.startOf('month').toDate(), to: now.endOf('month').toDate(), label: 'bulan ini' };
  }
}
