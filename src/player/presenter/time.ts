/** Writes the elapsed time as `mm:ss`, or `h:mm:ss` from one hour on (PRES-R9). */
export function formatElapsedTime(milliseconds: number): string {
  const totalSeconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const minutesAndSeconds = `${padTwoDigits(minutes)}:${padTwoDigits(seconds)}`;
  return hours > 0 ? `${hours}:${minutesAndSeconds}` : minutesAndSeconds;
}

/** Writes the time of day as `HH:MM` on a 24-hour clock (PRES-R8). */
export function formatClockTime(date: Date): string {
  return `${padTwoDigits(date.getHours())}:${padTwoDigits(date.getMinutes())}`;
}

function padTwoDigits(value: number): string {
  return String(value).padStart(2, "0");
}
