const getFirstDayOfWeek = (date: Date): Date => {
  const day = date.getDay();
  const diff = date.getDate() - (day === 0 ? 6 : day - 1);
  const monday = new Date(
    date.getFullYear(),
    date.getMonth(),
    diff,
    0,
    0,
    0,
    0,
  );

  return monday;
};

const getLastDayOfWeek = (date: Date): Date => {
  const firstDay = getFirstDayOfWeek(date);

  const sunday = new Date(
    firstDay.getFullYear(),
    firstDay.getMonth(),
    firstDay.getDate() + 6,
    0,
    0,
    0,
    0,
  );

  return sunday;
};

const getFirstDayOfPreviousWeek = (date: Date): Date => {
  const firstDayOfCurrentWeek = getFirstDayOfWeek(date);

  const firstDayOfPreviousWeek = new Date(
    firstDayOfCurrentWeek.getFullYear(),
    firstDayOfCurrentWeek.getMonth(),
    firstDayOfCurrentWeek.getDate() - 7,
    0,
    0,
    0,
    0,
  );

  return firstDayOfPreviousWeek;
};

const getLastDayOfPreviousWeek = (date: Date): Date => {
  const firstDayOfCurrentWeek = getFirstDayOfWeek(date);

  const lastDayOfPreviousWeek = new Date(
    firstDayOfCurrentWeek.getFullYear(),
    firstDayOfCurrentWeek.getMonth(),
    firstDayOfCurrentWeek.getDate() - 1,
    0,
    0,
    0,
    0,
  );

  return lastDayOfPreviousWeek;
};

const getFirstDayOfMonth = (date: Date): Date => {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  return firstDay;
};

const getLastDayOfMonth = (date: Date): Date => {
  const lastDay = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    0,
    0,
    0,
    0,
  );
  return lastDay;
};

const getFirstDayOfPreviousMonth = (date: Date): Date => {
  const firstDayOfCurrentMonth = getFirstDayOfMonth(date);

  const lastDayOfPreviousMonth = new Date(
    firstDayOfCurrentMonth.getFullYear(),
    firstDayOfCurrentMonth.getMonth(),
    firstDayOfCurrentMonth.getDate() - 1,
    0,
    0,
    0,
    0,
  );

  return getFirstDayOfMonth(lastDayOfPreviousMonth);
};

const getLastDayOfPreviousMonth = (date: Date): Date => {
  const firstDayOfCurrentMonth = getFirstDayOfMonth(date);

  const lastDayOfPreviousMonth = new Date(
    firstDayOfCurrentMonth.getFullYear(),
    firstDayOfCurrentMonth.getMonth(),
    firstDayOfCurrentMonth.getDate() - 1,
    0,
    0,
    0,
    0,
  );

  return lastDayOfPreviousMonth;
};

export const getWeekDates = () => {
  const now = new Date();
  const weekStart = getFirstDayOfWeek(now);
  const weekEnd = getLastDayOfWeek(now);
  return { weekStart, weekEnd };
};

export const getMonthDates = () => {
  const now = new Date();
  const monthStart = getFirstDayOfMonth(now);
  const monthEnd = getLastDayOfMonth(now);
  return { monthStart, monthEnd };
};

export const getPreviousWeekDates = () => {
  const now = new Date();
  const weekStart = getFirstDayOfPreviousWeek(now);
  const weekEnd = getLastDayOfPreviousWeek(now);
  return { weekStart, weekEnd };
};

export const getPreviousMonthDates = () => {
  const now = new Date();
  const monthStart = getFirstDayOfPreviousMonth(now);
  const monthEnd = getLastDayOfPreviousMonth(now);
  return { monthStart, monthEnd };
};
