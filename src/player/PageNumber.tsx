/** The page number the speaker is typing (NAV-R5), in either window's bottom right corner. */
export function PageNumber({ testId, digits }: { testId: string; digits: string }) {
  return (
    <div
      data-testid={testId}
      className="flex h-11 items-center rounded-lg bg-black/40 px-4 font-sans text-2xl text-white tabular-nums"
    >
      {digits}
    </div>
  );
}
