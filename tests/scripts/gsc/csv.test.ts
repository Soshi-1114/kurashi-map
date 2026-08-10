import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { toCsv, writeCsvFile } from "../../../scripts/gsc/csv";

interface Row {
  name: string;
  note: string;
  count: number;
}

const columns = [
  { key: "name", header: "name", value: (r: Row) => r.name },
  { key: "note", header: "note", value: (r: Row) => r.note },
  { key: "count", header: "count", value: (r: Row) => r.count },
];

describe("toCsv", () => {
  it("カンマ・改行・ダブルクォートを含むフィールドをクォートでエスケープする", () => {
    const rows: Row[] = [{ name: "川口市, 埼玉", note: '注記"引用"あり', count: 3 }];
    const csv = toCsv(rows, columns);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("name,note,count");
    expect(lines[1]).toBe('"川口市, 埼玉","注記""引用""あり",3');
  });

  it("undefined は空フィールドにする", () => {
    const rows = [{ name: "a", note: undefined as unknown as string, count: 1 }];
    const csv = toCsv(rows, columns);
    expect(csv.split("\r\n")[1]).toBe("a,,1");
  });

  it("小数は丸めて出力する", () => {
    const rows: Row[] = [{ name: "a", note: "b", count: 1 }];
    const csv = toCsv(rows, [{ key: "ratio", header: "ratio", value: () => 0.123456 }]);
    expect(csv.split("\r\n")[1]).toBe("0.1235");
  });
});

describe("writeCsvFile", () => {
  it("UTF-8 BOM 付きでファイルに書き出す", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gsc-csv-test-"));
    const file = path.join(dir, "out.csv");
    writeCsvFile(file, [{ name: "テスト", note: "", count: 1 }], columns);
    const buf = fs.readFileSync(file);
    expect(buf.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    const text = fs.readFileSync(file, "utf-8");
    expect(text).toContain("テスト");
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
