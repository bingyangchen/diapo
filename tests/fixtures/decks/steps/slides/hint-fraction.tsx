import { Step } from "#diapo";

export default function HintFraction() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 text-[48px]">
      <h1 className="text-[120px]">Hint fraction</h1>
      <Step at={1.5}>
        <p>Fraction hint</p>
      </Step>
    </div>
  );
}
