import { Step } from "#diapo";

// Three steps, with long notes that link to steps the slide lacks (PRES-R10.23, PRES-R10.25).
export const notes = `
[第 9 步](#/list/9)

[格式錯誤的步驟](#/list/abc)

List 第 1 段補充說明。

List 第 2 段補充說明。

List 第 3 段補充說明。

List 第 4 段補充說明。

List 第 5 段補充說明。

List 第 6 段補充說明。

List 第 7 段補充說明。

List 第 8 段補充說明。

List 第 9 段補充說明。

List 第 10 段補充說明。

List 第 11 段補充說明。

List 第 12 段補充說明。

List 第 13 段補充說明。

List 第 14 段補充說明。

List 第 15 段補充說明。

List 第 16 段補充說明。

List 第 17 段補充說明。

List 第 18 段補充說明。

List 第 19 段補充說明。

List 第 20 段補充說明。

List 第 21 段補充說明。

List 第 22 段補充說明。

List 第 23 段補充說明。

List 第 24 段補充說明。

List 第 25 段補充說明。

List 第 26 段補充說明。

List 第 27 段補充說明。

List 第 28 段補充說明。

List 第 29 段補充說明。

List 第 30 段補充說明。

List 第 31 段補充說明。

List 第 32 段補充說明。

List 第 33 段補充說明。

List 第 34 段補充說明。

List 第 35 段補充說明。

List 第 36 段補充說明。

List 第 37 段補充說明。

List 第 38 段補充說明。

List 第 39 段補充說明。

List 第 40 段補充說明。

`;

export default function List() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 text-[48px]">
      <h1 className="text-[120px]">List</h1>
      <Step at={1}>
        <p>First point</p>
      </Step>
      <Step at={2}>
        <p>Second point</p>
      </Step>
      <Step at={3}>
        <p>Third point</p>
      </Step>
    </div>
  );
}
