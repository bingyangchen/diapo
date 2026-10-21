// Not listed in deck.json, so the build leaves this slide out, though Tailwind still writes
// its classes into the CSS (FRAME-R5).
export default function Draft() {
  return (
    <h1 className="text-[120px] content-['unlisted-draft-marker']">Unlisted draft</h1>
  );
}
