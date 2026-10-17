// No notes (PRES-R10.2), a link to another slide (PRES-R9.18), a text field that keeps the
// audience window's keys (PRES-R3.8), a button that keeps the page's JS busy (PRES-R12.22),
// and a link to a site that responds with `Cross-Origin-Opener-Policy: same-origin` for the
// manual check of PRES-R13.6.
export default function Intro() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 text-[48px]">
      <h1 className="text-[120px]">Intro</h1>
      <a href="#/recap">Go to recap</a>
      <input aria-label="Text" className="border-2" />
      <button type="button" onClick={keepBusyForFiveSeconds}>
        Busy for 5 seconds
      </button>
      <a href="https://squoosh.app/">Open Squoosh</a>
    </div>
  );
}

function keepBusyForFiveSeconds() {
  const endTime = Date.now() + 5000;
  while (Date.now() < endTime) {
    // Runs JS without a break, so the window stops responding.
  }
}
