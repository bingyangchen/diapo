import { Step } from "#diapo";

export default function Intro() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 text-[48px]">
      <h1 className="text-[120px]">Intro</h1>
      <Step at={1}>
        <p>Intro one</p>
      </Step>
      <Step at={2}>
        <p>Intro two</p>
      </Step>
    </div>
  );
}
