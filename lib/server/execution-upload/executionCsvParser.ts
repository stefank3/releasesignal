import type {
  ParsedExecutionCsv,
  ParsedExecutionCsvRow,
} from "@/lib/server/execution-upload/executionUploadTypes";

type CsvParseResult =
  | {
      ok: true;
      csv: ParsedExecutionCsv;
    }
  | {
      ok: false;
      errors: { row?: number; message: string }[];
    };

type ParsedCsvRecord = {
  rowNumber: number;
  fields: string[];
};

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function parseCsvRecords(input: string): CsvParseResult {
  const source = stripBom(input);
  const records: ParsedCsvRecord[] = [];
  let fields: string[] = [];
  let field = "";
  let rowNumber = 1;
  let recordStartRow = 1;
  let inQuotes = false;
  let afterClosingQuote = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
        continue;
      }

      if (char === '"') {
        inQuotes = false;
        afterClosingQuote = true;
        continue;
      }

      if (char === "\n") rowNumber += 1;
      field += char;
      continue;
    }

    if (afterClosingQuote) {
      if (char === ",") {
        fields.push(field);
        field = "";
        afterClosingQuote = false;
        continue;
      }

      if (char === "\n") {
        fields.push(field);
        records.push({ rowNumber: recordStartRow, fields });
        fields = [];
        field = "";
        afterClosingQuote = false;
        rowNumber += 1;
        recordStartRow = rowNumber;
        continue;
      }

      if (char === "\r") {
        continue;
      }

      if (char === " " || char === "\t") {
        continue;
      }

      return {
        ok: false,
        errors: [
          {
            row: rowNumber,
            message: "malformed CSV: unexpected character after closing quote",
          },
        ],
      };
    }

    if (char === '"') {
      if (field.length > 0) {
        return {
          ok: false,
          errors: [
            {
              row: rowNumber,
              message: "malformed CSV: quote must start a quoted field",
            },
          ],
        };
      }

      inQuotes = true;
      continue;
    }

    if (char === ",") {
      fields.push(field);
      field = "";
      continue;
    }

    if (char === "\n") {
      fields.push(field);
      records.push({ rowNumber: recordStartRow, fields });
      fields = [];
      field = "";
      rowNumber += 1;
      recordStartRow = rowNumber;
      continue;
    }

    if (char === "\r") {
      continue;
    }

    field += char;
  }

  if (inQuotes) {
    return {
      ok: false,
      errors: [
        {
          row: recordStartRow,
          message: "malformed CSV: unclosed quoted field",
        },
      ],
    };
  }

  if (field.length > 0 || fields.length > 0 || afterClosingQuote) {
    fields.push(field);
    records.push({ rowNumber: recordStartRow, fields });
  }

  const nonEmptyRecords = records.filter((record) =>
    record.fields.some((value) => value.trim().length > 0)
  );

  if (nonEmptyRecords.length === 0) {
    return {
      ok: false,
      errors: [{ message: "empty execution CSV file" }],
    };
  }

  const [headerRecord, ...dataRecords] = nonEmptyRecords;
  const header = headerRecord.fields.map((value) => value.trim());

  if (header.length === 0 || header.every((value) => value.length === 0)) {
    return {
      ok: false,
      errors: [{ row: headerRecord.rowNumber, message: "missing CSV header" }],
    };
  }

  const malformedRecord = dataRecords.find(
    (record) => record.fields.length > header.length
  );

  if (malformedRecord) {
    return {
      ok: false,
      errors: [
        {
          row: malformedRecord.rowNumber,
          message: `malformed CSV: expected at most ${header.length} columns, got ${malformedRecord.fields.length}`,
        },
      ],
    };
  }

  const rows: ParsedExecutionCsvRow[] = dataRecords.map((record) => {
    const values: Record<string, string> = {};

    header.forEach((column, index) => {
      if (!column) return;
      values[column] = record.fields[index]?.trim() ?? "";
    });

    return {
      rowNumber: record.rowNumber,
      values,
    };
  });

  return {
    ok: true,
    csv: {
      header,
      rows,
    },
  };
}

export function parseExecutionCsv(input: string): CsvParseResult {
  return parseCsvRecords(input);
}
