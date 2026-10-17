// Escapes the outer quote in a quoted string (FRAME-R7.20). Prettier would drop the escapes.
// prettier-ignore
export const notes = "示範 \"引號\"";

export default function Quoted() {
  return <h1 className="text-[120px]">Quoted</h1>;
}
