import { Step } from "#diapo";

export default function Finale() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 text-[48px]">
      <h1 className="text-[120px]">Finale</h1>
      <Step at={1}>
        <p>Finale one</p>
      </Step>
      <Step at={2}>
        <p>Finale two</p>
      </Step>
    </div>
  );
}
