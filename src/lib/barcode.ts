export type SizeCategory = "PCS" | "REGULAR" | "LARGE";

export type ParsedBarcode = {
  raw: string;
  menu: string; // e.g., HOK
  size: SizeCategory;
  masterCode: string; // e.g., HOK-L, HOK-R, BRW
};

// Accept forms:
// 212-HOK-L => LARGE
// 342-HOK-R => REGULAR
// 343-BRW   => PCS
export function parseBarcode(input: string): ParsedBarcode | null {
  const raw = input.trim().toUpperCase();
  if (!raw) return null;

  const parts = raw.split("-");
  if (parts.length < 2) return null;

  let size: SizeCategory = "PCS";
  let menu = "";
  let masterCode = "";

  if (parts.length === 3) {
    const suffix = parts[2];
    if (suffix === "L") size = "LARGE";
    else if (suffix === "R") size = "REGULAR";
    else return null;
    menu = parts[1];
    masterCode = `${menu}-${suffix}`; // e.g., HOK-L
  } else if (parts.length === 2) {
    size = "PCS";
    // format: 343-BRW -> master code is only menu part (BRW)
    menu = parts[1];
    masterCode = menu; // e.g., BRW
  } else {
    return null;
  }

  if (!menu) return null;

  return { raw, menu, size, masterCode };
}


