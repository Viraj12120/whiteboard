export type Tone = "ink" | "accent" | "muted";

export type BoardElement =
  | {
      type: "text";
      x: number;
      y: number;
      text: string;
      size?: "small" | "medium" | "large";
      tone?: Tone;
    }
  | {
      type: "box";
      x: number;
      y: number;
      width: number;
      height: number;
      label: string;
      tone?: Tone;
    }
  | {
      type: "circle";
      x: number;
      y: number;
      radius: number;
      label: string;
      tone?: Tone;
    }
  | {
      type: "freeform";
      points: { x: number; y: number }[];
      closed: boolean;
      tone?: Tone;
    }
  | {
      type: "arrow" | "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      tone?: Tone;
    };

export type Whiteboard = {
  title: string;
  subtitle?: string;
  elements: BoardElement[];
};

export type TutorPractice = {
  question: string;
  answer: string;
};

export type TutorReply = {
  message: string;
  board: Whiteboard;
  practice: TutorPractice;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isPosition = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 3 && value <= 97;
const isTone = (value: unknown): value is Tone =>
  value === undefined || value === "ink" || value === "accent" || value === "muted";
const isLabel = (value: unknown, maximum: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= maximum;

function fitsLines(value: string, charactersPerLine: number, maximumLines = 3) {
  const words = value.trim().split(/\s+/);
  let lineCount = 1;
  let lineLength = 0;
  for (const word of words) {
    if (word.length > charactersPerLine) return false;
    const nextLength = lineLength === 0 ? word.length : lineLength + word.length + 1;
    if (nextLength > charactersPerLine) {
      lineCount += 1;
      lineLength = word.length;
    } else {
      lineLength = nextLength;
    }
    if (lineCount > maximumLines) return false;
  }
  return true;
}

function isBoardElement(value: unknown): value is BoardElement {
  if (!isRecord(value) || !isTone(value.tone)) return false;
  if (value.type === "text") {
    return isPosition(value.x) && isPosition(value.y) &&
      isLabel(value.text, 42) &&
      (value.size === undefined || value.size === "small" || value.size === "medium" || value.size === "large") &&
      fitsLines(value.text, 20, 2);
  }
  if (value.type === "box") {
    const labelLimit = typeof value.width === "number" ? Math.max(7, Math.floor(value.width * 0.9)) : 7;
    return isPosition(value.x) && isPosition(value.y) &&
      typeof value.width === "number" && Number.isFinite(value.width) && value.width >= 8 && value.width <= 70 &&
      typeof value.height === "number" && Number.isFinite(value.height) && value.height >= 8 && value.height <= 45 &&
      value.x + value.width <= 97 && value.y + value.height <= 92 &&
      isLabel(value.label, 100) &&
      fitsLines(value.label, labelLimit);
  }
  if (value.type === "circle") {
    const labelLimit = typeof value.radius === "number" ? Math.max(6, Math.floor(value.radius * 1.6)) : 6;
    return isPosition(value.x) && isPosition(value.y) &&
      typeof value.radius === "number" && Number.isFinite(value.radius) && value.radius >= 4 && value.radius <= 18 &&
      value.x - value.radius >= 3 && value.x + value.radius <= 97 &&
      value.y - value.radius >= 3 && value.y + value.radius <= 92 &&
      isLabel(value.label, 80) &&
      fitsLines(value.label, labelLimit);
  }
  if (value.type === "freeform") {
    return Array.isArray(value.points) &&
      value.points.length >= (value.closed === true ? 3 : 2) &&
      value.points.length <= 24 &&
      typeof value.closed === "boolean" &&
      value.points.every((point) =>
        isRecord(point) &&
        isPosition(point.x) &&
        isPosition(point.y),
      );
  }
  if (value.type === "arrow" || value.type === "line") {
    return isPosition(value.x1) && isPosition(value.y1) &&
      isPosition(value.x2) && isPosition(value.y2) &&
      !("label" in value);
  }
  return false;
}

type Bounds = { left: number; top: number; right: number; bottom: number };

function getElementBounds(element: BoardElement): Bounds | null {
  if (element.type === "box") {
    return {
      left: element.x,
      top: element.y,
      right: element.x + element.width,
      bottom: element.y + element.height,
    };
  }
  if (element.type === "circle") {
    return {
      left: element.x - element.radius,
      top: element.y - element.radius,
      right: element.x + element.radius,
      bottom: element.y + element.radius,
    };
  }
  if (element.type === "freeform") {
    return {
      left: Math.min(...element.points.map((point) => point.x)),
      top: Math.min(...element.points.map((point) => point.y)),
      right: Math.max(...element.points.map((point) => point.x)),
      bottom: Math.max(...element.points.map((point) => point.y)),
    };
  }
  if (element.type === "text") {
    const lines = wrapLines(element.text, 20);
    const width = Math.max(...lines.map((line) => line.length)) * 1.3 + 4;
    const height = lines.length * 3.5 + 2;
    return {
      left: element.x - width / 2,
      top: element.y - height / 2,
      right: element.x + width / 2,
      bottom: element.y + height / 2,
    };
  }
  return null;
}

function wrapLines(value: string, charactersPerLine: number): string[] {
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > charactersPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function hasPoorDiagramLayout(elements: BoardElement[]): boolean {
  const boundedElements = elements.flatMap((element) => {
    const bounds = getElementBounds(element);
    return bounds ? [{ bounds }] : [];
  });
  const overlapCandidates = elements.flatMap((element) => {
    if (element.type === "freeform" || element.type === "arrow" || element.type === "line") return [];
    const bounds = getElementBounds(element);
    return bounds ? [{ bounds }] : [];
  });
  const overlaps = overlapCandidates.some(({ bounds }, index) =>
    bounds.left < 3 || bounds.top < 3 || bounds.right > 97 || bounds.bottom > 92 ||
    overlapCandidates.slice(index + 1).some(({ bounds: other }) =>
      bounds.left < other.right + 1.5 &&
      bounds.right > other.left - 1.5 &&
      bounds.top < other.bottom + 1.5 &&
      bounds.bottom > other.top - 1.5,
    ),
  );
  if (overlaps || boundedElements.length < 2) return true;

  const left = Math.min(...boundedElements.map(({ bounds }) => bounds.left));
  const top = Math.min(...boundedElements.map(({ bounds }) => bounds.top));
  const right = Math.max(...boundedElements.map(({ bounds }) => bounds.right));
  const bottom = Math.max(...boundedElements.map(({ bounds }) => bounds.bottom));
  return right - left < 55 || bottom - top < 55;
}

export function isWhiteboard(value: unknown): value is Whiteboard {
  return isRecord(value) &&
    isLabel(value.title, 80) &&
    (value.subtitle === undefined || isLabel(value.subtitle, 140)) &&
    Array.isArray(value.elements) &&
    value.elements.length >= 3 &&
    value.elements.length <= 10 &&
    value.elements.every(isBoardElement) &&
    !hasPoorDiagramLayout(value.elements);
}

export function isTutorReply(value: unknown): value is TutorReply {
  return isRecord(value) &&
    isLabel(value.message, 1200) &&
    isWhiteboard(value.board) &&
    isRecord(value.practice) &&
    isLabel(value.practice.question, 240) &&
    isLabel(value.practice.answer, 600);
}
