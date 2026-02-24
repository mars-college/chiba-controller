import type { Media } from "./controlApi";

export type WebLaunchArgEntryKind =
  | "string"
  | "number"
  | "boolean"
  | "int_range"
  | "choice";

export type WebLaunchArgChoiceType = "string" | "number" | "boolean";

export type WebLaunchArgEntry = {
  id: string;
  key: string;
  kind: WebLaunchArgEntryKind;
  valueText: string;
  valueBool: boolean;
  rangeMin: string;
  rangeMax: string;
  rangeStep: string;
  rangePad: string;
  rangeBase: "dec" | "hex";
  rangePerScreen: boolean;
  choiceType: WebLaunchArgChoiceType;
  choiceValues: string[];
  choicePerScreen: boolean;
};

let argIdCounter = 1;

function nextArgId(): string {
  argIdCounter += 1;
  return `warg-${Date.now().toString(36)}-${argIdCounter.toString(36)}`;
}

export function createEmptyWebLaunchArgEntry(
  kind: WebLaunchArgEntryKind = "string"
): WebLaunchArgEntry {
  return {
    id: nextArgId(),
    key: "",
    kind,
    valueText: "",
    valueBool: true,
    rangeMin: "1",
    rangeMax: "999999",
    rangeStep: "",
    rangePad: "",
    rangeBase: "dec",
    rangePerScreen: true,
    choiceType: "string",
    choiceValues: [],
    choicePerScreen: true,
  };
}

function toBooleanText(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "on"
  ) {
    return true;
  }
  if (
    normalized === "0" ||
    normalized === "false" ||
    normalized === "no" ||
    normalized === "off"
  ) {
    return false;
  }
  return null;
}

function inferChoiceType(values: Array<string | number | boolean>): WebLaunchArgChoiceType {
  if (values.length === 0) return "string";
  const firstType = typeof values[0];
  if (
    values.every((value) => typeof value === firstType) &&
    (firstType === "string" || firstType === "number" || firstType === "boolean")
  ) {
    return firstType;
  }
  return "string";
}

export function webLaunchArgEntriesFromWebConfig(web?: Media["web"]): WebLaunchArgEntry[] {
  const args = web?.args;
  if (!args) return [];

  return Object.entries(args).map(([key, value]) => {
    const entry = createEmptyWebLaunchArgEntry();
    entry.key = key;

    if (typeof value === "string") {
      entry.kind = "string";
      entry.valueText = value;
      return entry;
    }
    if (typeof value === "number") {
      entry.kind = "number";
      entry.valueText = String(value);
      return entry;
    }
    if (typeof value === "boolean") {
      entry.kind = "boolean";
      entry.valueBool = value;
      return entry;
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (value.mode === "int_range") {
        entry.kind = "int_range";
        entry.rangeMin = String(value.min);
        entry.rangeMax = String(value.max);
        entry.rangeStep =
          typeof value.step === "number" ? String(value.step) : "";
        entry.rangePad = typeof value.pad === "number" ? String(value.pad) : "";
        entry.rangeBase = value.base === "hex" ? "hex" : "dec";
        entry.rangePerScreen = value.perScreen !== false;
        return entry;
      }

      if (value.mode === "choice") {
        entry.kind = "choice";
        const choices = Array.isArray(value.values)
          ? value.values.filter(
              (row): row is string | number | boolean =>
                typeof row === "string" ||
                typeof row === "number" ||
                typeof row === "boolean"
            )
          : [];
        entry.choiceType = inferChoiceType(choices);
        entry.choiceValues = choices.map((row) => String(row));
        entry.choicePerScreen = value.perScreen !== false;
        return entry;
      }
    }

    entry.kind = "string";
    entry.valueText = String(value);
    return entry;
  });
}

function hasMeaningfulValue(entry: WebLaunchArgEntry): boolean {
  if (entry.key.trim().length > 0) return true;
  if (entry.kind === "boolean") return entry.valueBool !== true;
  if (entry.kind === "choice") return entry.choiceValues.length > 0;
  if (entry.kind === "int_range") {
    return (
      entry.rangeMin.trim().length > 0 ||
      entry.rangeMax.trim().length > 0 ||
      entry.rangeStep.trim().length > 0 ||
      entry.rangePad.trim().length > 0 ||
      entry.rangeBase !== "dec" ||
      entry.rangePerScreen !== true
    );
  }
  return entry.valueText.trim().length > 0;
}

export function buildWebLaunchConfigFromEntries(args: {
  entries: WebLaunchArgEntry[];
  launchProfile: "none" | "home_assistant_login";
}): { config: Media["web"] | undefined; error: string | null } {
  const launchProfile =
    args.launchProfile === "home_assistant_login"
      ? "home_assistant_login"
      : undefined;

  const entries = args.entries;
  if (entries.length === 0 && !launchProfile) {
    return { config: undefined, error: null };
  }

  const webArgs: NonNullable<NonNullable<Media["web"]>["args"]> = {};
  const usedKeys = new Set<string>();

  for (let i = 0; i < entries.length; i += 1) {
    const row = entries[i];
    const label = row.key.trim() || `row ${i + 1}`;
    const key = row.key.trim();

    if (!key) {
      if (!hasMeaningfulValue(row)) {
        continue;
      }
      return {
        config: undefined,
        error: `Launch arg key is required for row ${i + 1}.`,
      };
    }

    if (usedKeys.has(key)) {
      return {
        config: undefined,
        error: `Duplicate launch arg key "${key}".`,
      };
    }
    usedKeys.add(key);

    if (row.kind === "string") {
      webArgs[key] = row.valueText;
      continue;
    }

    if (row.kind === "number") {
      const parsed = Number(row.valueText);
      if (!Number.isFinite(parsed)) {
        return {
          config: undefined,
          error: `Launch arg "${label}" must be a valid number.`,
        };
      }
      webArgs[key] = parsed;
      continue;
    }

    if (row.kind === "boolean") {
      webArgs[key] = row.valueBool;
      continue;
    }

    if (row.kind === "int_range") {
      const min = Number(row.rangeMin);
      const max = Number(row.rangeMax);
      const step = row.rangeStep.trim() ? Number(row.rangeStep) : undefined;
      const pad = row.rangePad.trim() ? Number(row.rangePad) : undefined;

      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
        return {
          config: undefined,
          error: `Launch arg "${label}" range requires integer min/max with max >= min.`,
        };
      }
      if (step !== undefined && (!Number.isInteger(step) || step <= 0)) {
        return {
          config: undefined,
          error: `Launch arg "${label}" range step must be a positive integer.`,
        };
      }
      if (pad !== undefined && (!Number.isInteger(pad) || pad < 0 || pad > 12)) {
        return {
          config: undefined,
          error: `Launch arg "${label}" range pad must be an integer between 0 and 12.`,
        };
      }

      webArgs[key] = {
        mode: "int_range",
        min,
        max,
        ...(step !== undefined ? { step } : {}),
        ...(pad !== undefined ? { pad } : {}),
        ...(row.rangeBase === "hex" ? { base: "hex" as const } : {}),
        perScreen: row.rangePerScreen,
      };
      continue;
    }

    const rawValues = row.choiceValues
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    if (rawValues.length === 0) {
      return {
        config: undefined,
        error: `Launch arg "${label}" random choice needs at least one value.`,
      };
    }

    if (row.choiceType === "string") {
      webArgs[key] = {
        mode: "choice",
        values: rawValues,
        perScreen: row.choicePerScreen,
      };
      continue;
    }

    if (row.choiceType === "number") {
      const parsed = rawValues.map((value) => Number(value));
      if (parsed.some((value) => !Number.isFinite(value))) {
        return {
          config: undefined,
          error: `Launch arg "${label}" random choice values must be numbers.`,
        };
      }
      webArgs[key] = {
        mode: "choice",
        values: parsed,
        perScreen: row.choicePerScreen,
      };
      continue;
    }

    const parsedBool: boolean[] = [];
    for (const raw of rawValues) {
      const value = toBooleanText(raw);
      if (value === null) {
        return {
          config: undefined,
          error:
            `Launch arg "${label}" random choice booleans must be true/false (or 1/0).`,
        };
      }
      parsedBool.push(value);
    }
    webArgs[key] = {
      mode: "choice",
      values: parsedBool,
      perScreen: row.choicePerScreen,
    };
  }

  if (Object.keys(webArgs).length === 0 && !launchProfile) {
    return { config: undefined, error: null };
  }

  return {
    config: {
      args: webArgs,
      ...(launchProfile ? { launchProfile } : {}),
    },
    error: null,
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((row) => canonicalize(row));
  if (!value || typeof value !== "object") return value;
  const input = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(input).sort()) {
    out[key] = canonicalize(input[key]);
  }
  return out;
}

export function webLaunchConfigSignature(web: Media["web"] | undefined): string {
  if (!web) return "";
  return JSON.stringify(canonicalize(web));
}
