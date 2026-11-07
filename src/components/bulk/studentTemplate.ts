import { downloadBook, Sheet, ref, type St } from "./xlsxBook";
import { DOB_MAX_AGE_DAYS, DOB_MIN_AGE_DAYS, MAX_ROWS, RELATIONSHIPS } from "./studentRules";

/**
 * Builds the student upload workbook for ONE school:
 *  1. "User Guide" (opens first)   2. "Students" (fill here; row 2 is a locked example)
 *  3. "Lists" (hidden, feeds the drop-downs)
 * Typing is limited by data validation. Because Excel's paste can bypass validation,
 * a locked "Row check" column re-tests every row with formulas, and the upload page
 * checks every row again.
 */
const NAVY = "#0A1F44";
const LINE = "#CBD5E8";

export function downloadStudentTemplate(o: { school: string; year: string; term: string; classLabels: string[] }): void {
  const date = new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  const classes = o.classLabels.length ? o.classLabels : ["(no classes set up yet)"];
  const nCls = classes.length;
  const FIRST = 3;
  const LAST = FIRST + MAX_ROWS - 1;
  const clsRange = `Lists!$A$2:$A$${nCls + 1}`;

  const banner = (g: [string, string]): St => ({ grad: g, deg: 0, color: "#FFFFFF", b: true, sz: 22, v: "center", indent: 1 });
  const sub = (g: [string, string]): St => ({ grad: g, deg: 0, color: "#EAF2FE", sz: 11, v: "center", indent: 1 });
  const sect = (g: [string, string]): St => ({ grad: g, deg: 0, color: "#FFFFFF", b: true, sz: 13, v: "center", indent: 1 });

  // ---------------- User Guide
  const gd = new Sheet("User Guide");
  gd.tab = "F0A500";
  gd.widths = [2, 24, 14, 44, 26, 38];
  const G1: [string, string] = ["#0A1F44", "#7A5CFA"];
  gd.merge(1, 2, 1, 6, { v: "STUDENT BULK ONBOARDING: USER GUIDE", s: banner(G1) });
  gd.heights.set(1, 40);
  gd.merge(2, 2, 2, 6, { v: `${o.school}  |  ${o.year}, ${o.term}  |  Template made on ${date}`, s: sub(G1) });
  gd.heights.set(2, 24);

  let r = 4;
  gd.merge(r, 2, r, 6, { v: "HOW TO USE THIS FILE (5 easy steps)", s: sect(["#0B5E6E", "#16A3B8"]) });
  gd.heights.set(r, 26);
  const steps: [string, string][] = [
    ["1", 'Click the "Students" tab at the bottom of the screen. Row 1 holds the headings and row 2 shows an example of how to fill each column. Row 2 is locked: it cannot be edited or cleared, and EduLink GH ignores it when you upload.'],
    ["2", "From row 3 downwards, type or paste one learner per row. Drop-down lists help you with Gender, Class and Relationship. You can add up to " + MAX_ROWS + " learners in one file."],
    ["3", 'Pasting from another worksheet? Use Paste Special > Values (Ctrl+Alt+V, then V) so your headings and formats are not copied over. Then look at the "Row check" column (J): green OK means the row is ready, red tells you what to fix.'],
    ["4", 'Save the file (keep it as .xlsx). In EduLink GH open Students > Bulk onboarding and upload it. Every row is checked again and you see a preview. Nothing is saved until you press "Import".'],
    ["5", "Only the essential details are needed now. Photos and other information can be added later from each learner's profile."],
  ];
  steps.forEach(([n, t], i) => {
    r++;
    gd.set(r, 2, { v: `Step ${n}`, s: { grad: ["#1C6FEB", "#7A5CFA"], deg: 0, color: "#FFFFFF", b: true, h: "center", v: "center", border: LINE } });
    gd.merge(r, 3, r, 6, { v: t, s: { fill: i % 2 ? "#F3F6FC" : "#FFFFFF", border: LINE, wrap: true, v: "center", indent: 1 } });
    gd.heights.set(r, 48);
  });

  r += 2;
  gd.merge(r, 2, r, 6, { v: "THE COLUMNS", s: sect(["#8C1C5A", "#E64A9B"]) });
  gd.heights.set(r, 26);
  r++;
  ["Column", "Required?", "What to enter", "Example", "Allowed values"].forEach((h, i) => gd.set(r, 2 + i, { v: h, s: { grad: [NAVY, "#1C6FEB"], deg: 0, color: "#FFFFFF", b: true, h: "center", v: "center", border: LINE } }));
  gd.heights.set(r, 24);
  const cols: [string, string, string, string, string][] = [
    ["First name", "Yes", "The learner's first name", "Kwame", "Letters; cannot be empty"],
    ["Middle name", "No", "Leave blank if there is none", "Yaw", "Letters"],
    ["Last name", "Yes", "The learner's surname", "Mensah", "Letters; cannot be empty"],
    ["Gender", "Yes", "Choose from the drop-down", "Male", "Male or Female"],
    ["Date of birth", "Yes", "A real date, typed as day/month/year", "12/05/2014", "Age between 2 and 26 years"],
    ["Class", "Yes", "Choose your school's class from the drop-down", classes[0], "Only the classes listed below"],
    ["Parent/guardian full name", "Yes", "The person we contact", "Ama Mensah", "Cannot be empty"],
    ["Relationship", "Yes", "Choose from the drop-down", "Mother", RELATIONSHIPS.join(", ")],
    ["Parent/guardian phone", "Yes", "10 digits starting with 0 (spaces are fine)", "0244123456", "Ghana mobile number"],
  ];
  cols.forEach((c, i) => {
    r++;
    c.forEach((v, k) => gd.set(r, 2 + k, { v, s: { fill: i % 2 ? "#F3F6FC" : "#FFFFFF", border: LINE, wrap: true, v: "center", b: k === 0, indent: 1, color: k === 1 ? (v === "Yes" ? "#B3261E" : "#5B6B8C") : "#1B2A41" } }));
    gd.heights.set(r, 30);
  });

  r += 2;
  gd.merge(r, 2, r, 6, { v: "GOOD TO KNOW", s: sect(["#0A5C3F", "#2DBE8C"]) });
  gd.heights.set(r, 26);
  const tips: string[] = [
    "Do not rename the tabs, change the headings or delete rows or columns. The sheet is protected so only the learner cells (row 3 downwards) can be edited.",
    'The "Row check" column (J) is automatic: green OK = ready, red = fix the message shown. Rows left empty are ignored.',
    "Date of birth must be a real Excel date. If it shows as text, retype it as 12/05/2014 (day/month/year).",
    "Phone numbers keep their leading 0 because the column is formatted as text. Pasted numbers without the 0 are fixed automatically on upload.",
    "A learner with the same first name, last name and date of birth as someone already in your school is flagged on upload so you do not register them twice.",
    "Class list not showing the class you need? Add it first under Settings > Classes, then download a fresh template.",
  ];
  tips.forEach((t, i) => {
    r++;
    gd.merge(r, 2, r, 6, { v: "•  " + t, s: { fill: i % 2 ? "#F3F6FC" : "#FFFFFF", border: LINE, wrap: true, v: "center", indent: 1 } });
    gd.heights.set(r, 34);
  });

  r += 2;
  gd.merge(r, 2, r, 6, { v: `YOUR SCHOOL'S CLASSES (${o.classLabels.length})`, s: sect(["#7A4B00", "#F0A500"]) });
  gd.heights.set(r, 26);
  r++;
  gd.merge(r, 2, r, 6, { v: classes.join("   |   "), s: { fill: "#FFF8E1", border: LINE, wrap: true, v: "center", indent: 1, b: true } });
  gd.heights.set(r, Math.max(34, 20 * Math.ceil(classes.join("   |   ").length / 110)));
  gd.freeze = null;

  // ---------------- Students
  const st = new Sheet("Students");
  st.tab = "1C6FEB";
  st.widths = [18, 18, 18, 12, 16, 22, 30, 16, 20, 44];
  const heads: [string, boolean][] = [
    ["First name *", true], ["Middle name (optional)", false], ["Last name *", true], ["Gender *", true], ["Date of birth *", true],
    ["Class *", true], ["Parent / guardian full name *", true], ["Relationship *", true], ["Parent / guardian phone *", true],
  ];
  heads.forEach(([h, req], i) =>
    st.set(1, 1 + i, { v: h, s: { grad: req ? [NAVY, "#1C6FEB"] : ["#4B5B7C", "#8A9BBF"], deg: 0, color: "#FFFFFF", b: true, h: "center", v: "center", wrap: true, border: LINE } }),
  );
  st.set(1, 10, { v: "Row check (automatic, do not edit)", s: { grad: ["#0A5C3F", "#2DBE8C"], deg: 0, color: "#FFFFFF", b: true, h: "center", v: "center", wrap: true, border: LINE } });
  st.heights.set(1, 38);
  const ex: St = { fill: "#E9EDF5", i: true, color: "#4B5B7C", border: LINE, v: "center" };
  const exDob = Math.round((Date.UTC(2014, 4, 12) - Date.UTC(1899, 11, 30)) / 86400000);
  st.set(2, 1, { v: "Kwame", s: ex });
  st.set(2, 2, { v: "Yaw", s: ex });
  st.set(2, 3, { v: "Mensah", s: ex });
  st.set(2, 4, { v: "Male", s: { ...ex, h: "center" } });
  st.set(2, 5, { v: exDob, s: { ...ex, fmt: "dd/mm/yyyy", h: "center" } });
  st.set(2, 6, { v: classes[0], s: ex });
  st.set(2, 7, { v: "Ama Mensah", s: ex });
  st.set(2, 8, { v: "Mother", s: ex });
  st.set(2, 9, { v: "0244123456", s: { ...ex, fmt: "@" } });
  st.set(2, 10, { v: "EXAMPLE ROW: locked, ignored on upload", s: { ...ex, b: true, color: "#7A4B00", fill: "#FFF4C2" } });
  st.heights.set(2, 22);

  const cell = (extra: St = {}): St => ({ unlocked: true, border: LINE, v: "center", fill: "#FFFFFF", ...extra });
  const phoneClean = (x: string) => `SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(${x}," ",""),"-",""),"+233","0")`;
  const phoneOk = (x: string) => {
    const c = phoneClean(x);
    return `AND(ISNUMBER(--${c}),OR(AND(LEN(${c})=10,LEFT(${c},1)="0"),LEN(${c})=9,AND(LEN(${c})=12,LEFT(${c},3)="233")))`;
  };
  // Excel limits a data-validation formula to 255 characters, so this one is deliberately short.
  const phoneDv = (x: string) => `AND(ISNUMBER(--SUBSTITUTE(${x}," ","")),LEN(SUBSTITUTE(${x}," ",""))>=9,LEN(SUBSTITUTE(${x}," ",""))<=10)`;
  for (let row = FIRST; row <= LAST; row++) {
    for (let c = 1; c <= 9; c++) {
      const extra: St = c === 5 ? { fmt: "dd/mm/yyyy", h: "center" } : c === 9 ? { fmt: "@" } : c === 4 ? { h: "center" } : {};
      st.set(row, c, { s: cell(extra) });
    }
    const A = `A${row}`, C = `C${row}`, D = `D${row}`, E = `E${row}`, F = `F${row}`, Gc = `G${row}`, H = `H${row}`, I = `I${row}`;
    const f =
      `IF(COUNTA(A${row}:I${row})=0,"",` +
      `IF(TRIM(${A})="","Fill in first name",` +
      `IF(TRIM(${C})="","Fill in last name",` +
      `IF(NOT(OR(UPPER(TRIM(${D}))="MALE",UPPER(TRIM(${D}))="FEMALE",UPPER(TRIM(${D}))="M",UPPER(TRIM(${D}))="F")),"Gender: choose Male or Female",` +
      `IF(NOT(ISNUMBER(${E})),"Date of birth: enter a real date (dd/mm/yyyy)",` +
      `IF(OR(${E}>TODAY()-${DOB_MIN_AGE_DAYS},${E}<TODAY()-${DOB_MAX_AGE_DAYS}),"Date of birth looks wrong (age 2 to 26)",` +
      `IF(COUNTIF(${clsRange},TRIM(${F}))=0,"Class: choose from the list",` +
      `IF(TRIM(${Gc})="","Fill in parent/guardian name",` +
      `IF(COUNTIF(Lists!$C$2:$C$${RELATIONSHIPS.length + 1},TRIM(${H}))=0,"Relationship: choose from the list",` +
      `IF(NOT(${phoneOk(I)}),"Phone: 10 digits e.g. 0240000000",` +
      `IF(COUNTIFS($A$${FIRST}:$A$${LAST},${A},$C$${FIRST}:$C$${LAST},${C},$E$${FIRST}:$E$${LAST},${E})>1,"Same learner appears twice in this sheet","OK"))))))))))`;
    st.set(row, 10, { f, s: { border: LINE, v: "center", b: true, fill: "#FFFFFF", indent: 1 } });
  }
  st.freeze = [2, 0];
  st.protectPw = "EduLinkGH-bulk";
  st.cfs.push(`<conditionalFormatting sqref="A${FIRST}:J${LAST}"><cfRule type="expression" dxfId="3" priority="__P__"><formula>AND($J${FIRST}&lt;&gt;"",$J${FIRST}&lt;&gt;"OK")</formula></cfRule></conditionalFormatting>`);
  st.cfs.push(`<conditionalFormatting sqref="J${FIRST}:J${LAST}"><cfRule type="expression" dxfId="4" priority="__P__"><formula>$J${FIRST}="OK"</formula></cfRule></conditionalFormatting>`);

  const dv = (type: string, sq: string, f1: string, f2: string | null, title: string, msg: string, extra = "") =>
    `<dataValidation type="${type}"${extra} allowBlank="1" showInputMessage="1" showErrorMessage="1" errorStyle="stop" errorTitle="${title}" error="${msg}" promptTitle="${title}" prompt="${msg}" sqref="${sq}"><formula1>${f1.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</formula1>${f2 ? `<formula2>${f2.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</formula2>` : ""}</dataValidation>`;
  st.validations.push(
    dv("custom", `A${FIRST}:A${LAST}`, `LEN(TRIM(A${FIRST}))>0`, null, "First name", "Enter the learner's first name."),
    dv("custom", `C${FIRST}:C${LAST}`, `LEN(TRIM(C${FIRST}))>0`, null, "Last name", "Enter the learner's last name."),
    dv("list", `D${FIRST}:D${LAST}`, '"Male,Female"', null, "Gender", "Choose Male or Female."),
    dv("date", `E${FIRST}:E${LAST}`, `TODAY()-${DOB_MAX_AGE_DAYS}`, `TODAY()-${DOB_MIN_AGE_DAYS}`, "Date of birth", "Enter a real date as day/month/year, for a learner aged 2 to 26.", ' operator="between"'),
    dv("list", `F${FIRST}:F${LAST}`, clsRange, null, "Class", "Choose one of your school's classes."),
    dv("custom", `G${FIRST}:G${LAST}`, `LEN(TRIM(G${FIRST}))>0`, null, "Parent/guardian", "Enter the parent or guardian's full name."),
    dv("list", `H${FIRST}:H${LAST}`, `"${RELATIONSHIPS.join(",")}"`, null, "Relationship", "Choose from the list."),
    dv("custom", `I${FIRST}:I${LAST}`, phoneDv(`I${FIRST}`), null, "Phone number", "Enter 10 digits starting with 0, for example 0244123456 (no spaces or +233)."),
  );

  // ---------------- Lists (hidden)
  const ls = new Sheet("Lists");
  ls.hidden = true;
  ls.widths = [30, 14, 18];
  ls.set(1, 1, { v: "Classes" });
  classes.forEach((c, i) => ls.set(2 + i, 1, { v: c }));
  ls.set(1, 2, { v: "Gender" });
  ls.set(2, 2, { v: "Male" });
  ls.set(3, 2, { v: "Female" });
  ls.set(1, 3, { v: "Relationship" });
  RELATIONSHIPS.forEach((x, i) => ls.set(2 + i, 3, { v: x }));

  // quiet unused import warning for ref
  void ref;
  const safe = o.school.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() || "School";
  downloadBook(`${safe} - Student upload template.xlsx`, [gd, st, ls]);
}
