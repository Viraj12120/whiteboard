import { describe, expect, it } from "vitest";
import { isTutorReply, isWhiteboard } from "./whiteboard";

describe("whiteboard output validation", () => {
  const validBoard = {
    title: "Water cycle",
    subtitle: "A repeating process",
    elements: [
      { type: "box", x: 10, y: 27, width: 20, height: 18, label: "Ocean", tone: "accent" },
      { type: "arrow", x1: 32, y1: 38, x2: 52, y2: 75, tone: "muted" },
      { type: "circle", x: 65, y: 75, radius: 9, label: "Clouds" },
    ],
  };
  const validPractice = {
    question: "What causes water to evaporate?",
    answer: "Heat gives liquid water enough energy to become water vapor.",
  };
  const validNarration = [
    { text: "Heat changes surface water into vapor.", elementIndices: [0] },
    { text: "The vapor moves upward and cools.", elementIndices: [1] },
    { text: "Water droplets gather to form clouds.", elementIndices: [2] },
  ];

  it("accepts a bounded visual explanation", () => {
    expect(isWhiteboard(validBoard)).toBe(true);
    expect(isTutorReply({
      message: "Water cycles through land, air and sea.",
      board: validBoard,
      practice: validPractice,
      narration: validNarration,
    })).toBe(true);
  });

  it("requires a bounded, usable practice question and sample answer", () => {
    const reply = {
      message: "Water cycles through land, air and sea.",
      board: validBoard,
      practice: validPractice,
      narration: validNarration,
    };

    expect(isTutorReply({ ...reply, practice: undefined })).toBe(false);
    expect(isTutorReply({ ...reply, practice: { question: " ", answer: "A usable answer." } })).toBe(false);
    expect(isTutorReply({ ...reply, practice: { question: "A usable question?", answer: " " } })).toBe(false);
    expect(isTutorReply({
      ...reply,
      practice: { question: "q".repeat(241), answer: "A usable answer." },
    })).toBe(false);
    expect(isTutorReply({
      ...reply,
      practice: { question: "A usable question?", answer: "a".repeat(601) },
    })).toBe(false);
  });

  it("requires narration steps to map every board element exactly by index", () => {
    const reply = {
      message: "Water cycles through land, air and sea.",
      board: validBoard,
      practice: validPractice,
      narration: validNarration,
    };

    expect(isTutorReply({ ...reply, narration: undefined })).toBe(false);
    expect(isTutorReply({ ...reply, narration: validNarration.slice(0, 2) })).toBe(false);
    expect(isTutorReply({
      ...reply,
      narration: [
        { text: "Water evaporates.", elementIndices: [0] },
        { text: "Vapor rises.", elementIndices: [1] },
        { text: "Clouds gather.", elementIndices: [1] },
      ],
    })).toBe(false);
    expect(isTutorReply({
      ...reply,
      narration: [
        { text: "Water evaporates.", elementIndices: [0] },
        { text: "Vapor rises.", elementIndices: [1.5] },
        { text: "Clouds gather.", elementIndices: [2] },
      ],
    })).toBe(false);
    expect(isTutorReply({
      ...reply,
      narration: [
        { text: "Water evaporates.", elementIndices: [0] },
        { text: "Vapor rises.", elementIndices: [1] },
        { text: "Clouds gather.", elementIndices: [3] },
      ],
    })).toBe(false);
  });

  it("accepts a spaced diagram that uses the full canvas", () => {
    expect(isWhiteboard({
      title: "Projectile Motion",
      elements: [
        { type: "text", x: 50, y: 12, text: "Projectile Motion", tone: "accent" },
        { type: "box", x: 10, y: 28, width: 22, height: 12, label: "Launch", tone: "ink" },
        { type: "circle", x: 50, y: 45, radius: 10, label: "Peak", tone: "muted" },
        { type: "box", x: 68, y: 62, width: 22, height: 12, label: "Landing", tone: "ink" },
        { type: "arrow", x1: 32, y1: 34, x2: 40, y2: 38, tone: "ink" },
        { type: "arrow", x1: 60, y1: 55, x2: 68, y2: 62, tone: "ink" },
        { type: "text", x: 50, y: 80, text: "Curved parabolic path", tone: "ink" },
      ],
    })).toBe(true);
  });

  it("accepts open and closed freeform paths", () => {
    expect(isWhiteboard({
      title: "Freeform sketch",
      elements: [
        {
          type: "freeform",
          points: [{ x: 10, y: 12 }, { x: 48, y: 18 }, { x: 86, y: 72 }, { x: 90, y: 90 }],
          closed: false,
          tone: "accent",
        },
        { type: "box", x: 10, y: 40, width: 20, height: 18, label: "Start" },
        { type: "circle", x: 70, y: 74, radius: 8, label: "End" },
      ],
    })).toBe(true);
    expect(isWhiteboard({
      title: "Freeform shape",
      elements: [
        {
          type: "freeform",
          points: [{ x: 15, y: 15 }, { x: 50, y: 30 }, { x: 85, y: 80 }],
          closed: true,
        },
        { type: "text", x: 20, y: 70, text: "Sketch" },
        { type: "box", x: 68, y: 20, width: 20, height: 12, label: "Label" },
      ],
    })).toBe(true);
  });

  it("rejects malformed or out-of-bounds freeform paths", () => {
    const boardWithPath = (points: { x: number; y: number }[], closed = false) => ({
      ...validBoard,
      elements: [
        { type: "freeform", points, closed },
        { type: "box", x: 10, y: 40, width: 20, height: 18, label: "Start" },
        { type: "circle", x: 70, y: 74, radius: 8, label: "End" },
      ],
    });

    expect(isWhiteboard(boardWithPath([{ x: 10, y: 10 }]))).toBe(false);
    expect(isWhiteboard(boardWithPath([{ x: 10, y: 10 }, { x: 90, y: 90 }], true))).toBe(false);
    expect(isWhiteboard(boardWithPath([{ x: 10, y: 10 }, { x: 101, y: 90 }]))).toBe(false);
    expect(isWhiteboard(boardWithPath(Array.from({ length: 25 }, (_, index) => ({ x: 10 + index, y: 10 + index }))))).toBe(false);
  });

  it("rejects unknown drawing primitives", () => {
    expect(isWhiteboard({
      ...validBoard,
      elements: [{ type: "script", code: "alert(1)", x: 10, y: 20 }],
    })).toBe(false);
  });

  it("rejects off-canvas and oversized elements", () => {
    expect(isWhiteboard({
      ...validBoard,
      elements: [{ type: "arrow", x1: -10, y1: 20, x2: 30, y2: 20 }],
    })).toBe(false);
    expect(isWhiteboard({
      ...validBoard,
      elements: Array.from({ length: 15 }, () => ({ type: "text", x: 10, y: 20, text: "Too many" })),
    })).toBe(false);
  });

  it("rejects empty diagrams and invalid tone values", () => {
    expect(isWhiteboard({ ...validBoard, elements: [] })).toBe(false);
    expect(isWhiteboard({ ...validBoard, elements: validBoard.elements.slice(0, 2) })).toBe(false);
    expect(isWhiteboard({
      ...validBoard,
      elements: [{ type: "text", x: 10, y: 20, text: "Unsafe color", tone: "url(javascript:...)" }],
    })).toBe(false);
  });

  it("rejects labels that would be clipped in the diagram", () => {
    expect(isWhiteboard({
      ...validBoard,
      elements: [{ type: "box", x: 10, y: 30, width: 10, height: 12, label: "This label is far too long to fit" }],
    })).toBe(false);
  });

  it("rejects overlapping diagram items and arrow labels", () => {
    expect(isWhiteboard({
      ...validBoard,
      elements: [
        { type: "text", x: 50, y: 40, text: "Overlapping label" },
        { type: "box", x: 42, y: 32, width: 20, height: 18, label: "Node" },
        { type: "arrow", x1: 20, y1: 50, x2: 80, y2: 50 },
      ],
    })).toBe(false);
    expect(isWhiteboard({
      ...validBoard,
      elements: validBoard.elements.map((element) =>
        element.type === "arrow" ? { ...element, label: "Not allowed" } : element,
      ),
    })).toBe(false);
  });

  it("rejects diagrams crowded into a small part of the canvas", () => {
    expect(isWhiteboard({
      ...validBoard,
      elements: [
        { type: "text", x: 45, y: 40, text: "First" },
        { type: "text", x: 55, y: 40, text: "Second" },
        { type: "circle", x: 50, y: 55, radius: 4, label: "Third" },
      ],
    })).toBe(false);
  });
});
