/** A text area that takes focus as soon as it renders (OVW-R6.3, OVW-R10.5, NAV-R14.8). */
export default function Repl() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-16 text-[48px]">
      <h1 className="text-[120px]">Repl</h1>
      <textarea aria-label="Code" className="border-2" autoFocus />
    </div>
  );
}
