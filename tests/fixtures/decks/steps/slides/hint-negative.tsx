import { Step, useStep } from "#diapo";

export default function HintNegative() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 text-[48px]">
      <h1 className="text-[120px]">Hint negative</h1>
      <Step at={1}>
        <p>Negative one</p>
      </Step>
      <StepNumber />
    </div>
  );
}

function StepNumber() {
  const step = useStep(-1);
  return <p>Step {step}</p>;
}
