const LINES = Array.from(
  { length: 60 },
  (_, index) => `const value${index + 1} = ${index + 1};`,
);

/**
 * A code block taller than its box, which keys scroll once the speaker clicks it, except under
 * an overview that only the presenter window shows (OVW-R12.15).
 */
export default function Code() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-12">
      <h1 className="text-[120px]">Code</h1>
      <pre
        aria-label="Code block"
        className="h-[480px] w-[1200px] overflow-auto bg-neutral-200 p-8 text-[40px]"
      >
        {LINES.join("\n")}
      </pre>
    </div>
  );
}
