// solve.js — fast, dependency-free CSV reader.
//
// Exports run(input) where input is { text, header } and the result is
// { columns, rows, errors }, matching the csv-reader 1.0.0 reading rules:
//
// - Text is read once, left to right. A leading U+FEFF is dropped.
// - A record ends at LF or CRLF. A line with no characters is not a record.
// - Outside quotes, a CR not followed by LF is dropped (error stray_cr).
// - A field opened with a quote runs to the next non-doubled quote; "" inside
//   means one quote; CRLF or a lone CR inside quotes reads as LF; anything
//   after the closing quote up to a comma or the next line end is appended
//   verbatim (error quote_junk when the field ends).
// - A quote that never closes is an ordinary character and the text after it
//   is read again as unquoted (error unterminated_quote).
// - A quote inside an unquoted field is an ordinary character.
// - Fields stay strings, never trimmed or converted.
// - columns is the first record when header is true, else null; rows hold the
//   records after it (all records when header is false). Each record is
//   padded with "" (short_row, with fields: its field count) or truncated
//   (long_row, with extra: the dropped fields) to the first record's width.
// - Every error is { code, line, row } in discovery order; short_row and
//   long_row are recorded when the record ends. line is the 1-based line
//   where the record started (counting every LF, CRLF, and lone CR inside
//   quotes); row is the record's index in rows (null for the header).

export function run(input) {
  let text = input.text;
  if (typeof text !== 'string') text = text == null ? '' : String(text);
  const header = !!input.header;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const n = text.length;
  const rows = [];
  const errors = [];
  let columns = null;
  let width = -1; // field count of the first record; -1 until the first record
  let line = 1; // current 1-based line number
  let i = 0; // read cursor
  let records = 0; // real records completed so far
  let recLine = 1; // line where the record currently being parsed started

  // Row index the in-progress record will have in `rows` (null for header).
  const curRow = () => (header && records === 0 ? null : records - (header ? 1 : 0));

  // Delimiters for unquoted text: comma, LF, CR.
  const DELIM = /[,\r\n]/g;

  // Scan from the cursor to the next comma, LF, or CRLF (or EOF), discarding
  // stray CRs (CR not followed by LF) with a stray_cr error each. The cursor
  // is left at the delimiter (not consumed). Returns the scanned string.
  function scanToDelim() {
    let start = i;
    let parts = null; // lazily created when a stray CR forces segment joins
    for (;;) {
      DELIM.lastIndex = i;
      const m = DELIM.exec(text);
      if (!m) {
        if (parts) {
          parts.push(text.slice(start));
          i = n;
          return parts.join('');
        }
        const s = text.slice(start);
        i = n;
        return s;
      }
      const d = m.index;
      const ch = m[0];
      // Comma, LF, or CR followed by LF: a real delimiter.
      if (ch === ',' || ch === '\n' || text.charCodeAt(d + 1) === 10) {
        if (parts) {
          parts.push(text.slice(start, d));
          i = d;
          return parts.join('');
        }
        const s = text.slice(start, d);
        i = d;
        return s;
      }
      // Lone CR: stray, drop it and keep scanning.
      if (!parts) parts = [];
      parts.push(text.slice(start, d));
      errors.push({ code: 'stray_cr', line: recLine, row: curRow() });
      i = d + 1;
      start = i;
    }
  }

  // Normalize newlines inside a quoted field: CRLF and lone CR become LF.
  // Counts every newline so the line counter stays correct.
  function normNewlines(s) {
    if (s.indexOf('\r') === -1 && s.indexOf('\n') === -1) return s;
    let count = 0;
    const out = s.replace(/\r\n?|\n/g, () => {
      count++;
      return '\n';
    });
    line += count;
    return out;
  }

  // Parse one field starting at the cursor. Leaves the cursor at the comma,
  // line terminator, or EOF that ends the field (not consumed).
  function parseField() {
    if (text.charCodeAt(i) === 34) {
      // Quoted field: find the closing quote, treating "" as an escape.
      let pos = i + 1;
      let escaped = false;
      let close = -1;
      for (;;) {
        const q = text.indexOf('"', pos);
        if (q === -1) break;
        if (text.charCodeAt(q + 1) === 34) {
          escaped = true;
          pos = q + 2;
          continue;
        }
        close = q;
        break;
      }
      if (close === -1) {
        // Never closed: the quote is an ordinary character; re-read the
        // rest as unquoted.
        errors.push({ code: 'unterminated_quote', line: recLine, row: curRow() });
        return scanToDelim();
      }
      const content = text.slice(i + 1, close);
      const value = escaped
        ? normNewlines(content.split('""').join('"'))
        : normNewlines(content);
      i = close + 1;
      // Junk after the closing quote, up to a comma or line end.
      const junk = scanToDelim();
      if (junk.length > 0) {
        errors.push({ code: 'quote_junk', line: recLine, row: curRow() });
        return value + junk;
      }
      return value;
    }
    return scanToDelim();
  }

  while (i < n) {
    recLine = line;
    // Leading stray CRs at the start of a line: drop them with an error.
    while (
      i < n &&
      text.charCodeAt(i) === 13 &&
      text.charCodeAt(i + 1) !== 10
    ) {
      errors.push({ code: 'stray_cr', line: recLine, row: curRow() });
      i++;
    }
    if (i >= n) break;
    const c = text.charCodeAt(i);
    if (c === 10) {
      // LF: empty line, not a record.
      i++;
      line++;
      continue;
    }
    if (c === 13) {
      // CR followed by LF: CRLF, empty line, not a record.
      i += 2;
      line++;
      continue;
    }
    // Fast path: a line with no quote and no stray CR is just split(',').
    // (A quote or a CR anywhere in the line forces the field parser.)
    const lineEnd = text.indexOf('\n', i);
    let contentEnd;
    let nextI;
    let nextLine;
    if (lineEnd === -1) {
      contentEnd = n;
      nextI = n;
      nextLine = line;
    } else if (text.charCodeAt(lineEnd - 1) === 13) {
      contentEnd = lineEnd - 1; // CRLF terminator
      nextI = lineEnd + 1;
      nextLine = line + 1;
    } else {
      contentEnd = lineEnd;
      nextI = lineEnd + 1;
      nextLine = line + 1;
    }
    const segment = text.slice(i, contentEnd);
    let fields;
    if (segment.indexOf('"') === -1 && segment.indexOf('\r') === -1) {
      fields = segment.split(',');
      i = nextI;
      line = nextLine;
    } else {
      // Slow path: quoted fields and/or stray CRs need the field parser.
      fields = [];
      for (;;) {
        fields.push(parseField());
        if (i < n && text.charCodeAt(i) === 44) {
          i++; // comma: another field follows
          continue;
        }
        break;
      }
      // Consume the record terminator.
      if (i < n) {
        if (text.charCodeAt(i) === 10) {
          i++;
          line++;
        } else if (text.charCodeAt(i) === 13) {
          // CRLF (a lone CR cannot survive the field scan).
          i += 2;
          line++;
        }
      }
    }
    const row = curRow();
    if (width === -1) {
      width = fields.length;
      if (header) columns = fields;
      else rows.push(fields);
    } else {
      if (fields.length < width) {
        errors.push({ code: 'short_row', line: recLine, row, fields: fields.length });
        while (fields.length < width) fields.push('');
      } else if (fields.length > width) {
        const extra = fields.slice(width);
        errors.push({ code: 'long_row', line: recLine, row, extra });
        fields.length = width;
      }
      rows.push(fields);
    }
    records++;
  }

  return { columns, rows, errors };
}
