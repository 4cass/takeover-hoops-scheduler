import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';

// Philippines timezone
export const PHILIPPINES_TZ = 'Asia/Manila';

// Get current time in Philippines timezone
export const getCurrentPhilippinesTime = (): Date => {
  return toZonedTime(new Date(), PHILIPPINES_TZ);
};

// Convert a date to Philippines timezone
export const toPhilippinesTime = (date: Date | string): Date => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return toZonedTime(dateObj, PHILIPPINES_TZ);
};

// Convert from Philippines timezone to UTC
export const fromPhilippinesTime = (date: Date): Date => {
  return fromZonedTime(date, PHILIPPINES_TZ);
};

// Format date in Philippines timezone
export const formatInPhilippinesTime = (date: Date | string, format: string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(dateObj, PHILIPPINES_TZ, format);
};

// Get today's date in Philippines timezone (date only, no time)
export const getTodayInPhilippines = (): Date => {
  const now = getCurrentPhilippinesTime();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

// Check if a date is today in Philippines timezone
export const isTodayInPhilippines = (date: Date | string): boolean => {
  const inputDate = typeof date === 'string' ? new Date(date) : date;
  const phillipinesDate = toPhilippinesTime(inputDate);
  const today = getTodayInPhilippines();
  
  return phillipinesDate.getFullYear() === today.getFullYear() &&
         phillipinesDate.getMonth() === today.getMonth() &&
         phillipinesDate.getDate() === today.getDate();
};