"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { BoardElement, NarrationStep, Tone, Whiteboard as WhiteboardData } from "@/lib/whiteboard";

type PlaybackState = "idle" | "playing" | "paused" | "ended" | "error";

function subscribeToSpeechSupport() {
  return () => {};
}

function getSpeechSupportSnapshot() {
  return "speechSynthesis" in window;
}

function getSpeechSupportServerSnapshot() {
  return false;
}

const toneClass: Record<Tone, string> = {
  ink: "draw-ink",
  accent: "draw-accent",
  muted: "draw-muted",
};

function wrapText(value: string, limit: number) {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > limit && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function TextLines({ value, limit, lineHeight = 1.2 }: { value: string; limit: number; lineHeight?: number }) {
  return <>{wrapText(value, limit).map((line, index) => <tspan key={`${index}-${line}`} dy={index === 0 ? 0 : `${lineHeight}em`}>{line}</tspan>)}</>;
}

function freeformPath(points: { x: number; y: number }[], closed: boolean) {
  const scaled = points.map(({ x, y }) => ({ x: x * 10, y: y * 7 }));
  let path = `M ${scaled[0].x} ${scaled[0].y}`;
  const segmentCount = closed ? scaled.length : scaled.length - 1;
  for (let index = 0; index < segmentCount; index += 1) {
    const startIndex = index % scaled.length;
    const endIndex = (index + 1) % scaled.length;
    const previousIndex = closed ? (index - 1 + scaled.length) % scaled.length : Math.max(0, index - 1);
    const nextIndex = closed ? (index + 2) % scaled.length : Math.min(scaled.length - 1, index + 2);
    const previous = scaled[previousIndex];
    const start = scaled[startIndex];
    const end = scaled[endIndex];
    const next = scaled[nextIndex];
    const firstControlX = start.x + (end.x - previous.x) / 6;
    const firstControlY = start.y + (end.y - previous.y) / 6;
    const secondControlX = end.x - (next.x - start.x) / 6;
    const secondControlY = end.y - (next.y - start.y) / 6;
    path += ` C ${firstControlX} ${firstControlY}, ${secondControlX} ${secondControlY}, ${end.x} ${end.y}`;
  }
  return closed ? `${path} Z` : path;
}

function getRevealedElementIndices(narration: NarrationStep[], throughStep: number) {
  return [...new Set(narration.slice(0, throughStep + 1).flatMap((step) => step.elementIndices))];
}

function RenderElement({ element, index, active }: { element: BoardElement; index: number; active: boolean }) {
  const tone = toneClass[element.tone ?? "ink"];
  const activeClass = active ? "board-element-active" : "";
  if (element.type === "text") {
    const size = element.size === "large" ? 32 : element.size === "small" ? 17 : 23;
    const limit = 20;
    const lines = wrapText(element.text, limit);
    const firstLineY = element.y * 7 - ((lines.length - 1) * size * 1.2) / 2;
    return (
      <text key={index} x={element.x * 10} y={firstLineY} textAnchor="middle" dominantBaseline="middle" className={`board-element board-text ${tone} ${activeClass}`} fontSize={size}>
        <TextLines value={element.text} limit={limit} />
      </text>
    );
  }
  if (element.type === "box") {
    const width = element.width * 10;
    const height = element.height * 7;
    const lines = wrapText(element.label, Math.max(7, Math.floor(element.width * 0.9)));
    const startY = element.y * 7 + height / 2 - ((lines.length - 1) * 13) / 2 + 5;
    return (
      <g key={index} className={`board-element ${activeClass}`}>
        <rect x={element.x * 10} y={element.y * 7} width={width} height={height} rx="8" className={`board-box ${tone}`} />
        <text x={(element.x * 10) + width / 2} y={startY} textAnchor="middle" className="board-label">
          {lines.map((line, lineIndex) => <tspan key={lineIndex} x={(element.x * 10) + width / 2} dy={lineIndex === 0 ? 0 : 16}>{line}</tspan>)}
        </text>
      </g>
    );
  }
  if (element.type === "circle") {
    const labelLimit = Math.max(6, Math.floor(element.radius * 1.6));
    return (
      <g key={index} className={`board-element ${activeClass}`}>
        <circle cx={element.x * 10} cy={element.y * 7} r={element.radius * 7} className={`board-circle ${tone}`} />
        <text x={element.x * 10} y={element.y * 7 + 4} textAnchor="middle" className="board-label">
          <TextLines value={element.label} limit={labelLimit} />
        </text>
      </g>
    );
  }
  if (element.type === "freeform") {
    return (
      <path
        key={index}
        d={freeformPath(element.points, element.closed)}
        className={`board-element board-freeform ${tone} ${activeClass}`}
      />
    );
  }

  const x1 = element.x1 * 10;
  const y1 = element.y1 * 7;
  const x2 = element.x2 * 10;
  const y2 = element.y2 * 7;
  return (
    <g key={index} className={`board-element ${tone} ${activeClass}`}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} className={element.type === "arrow" ? "board-arrow" : "board-line"} markerEnd={element.type === "arrow" ? "url(#board-arrowhead)" : undefined} />
    </g>
  );
}

export function Whiteboard({
  board,
  narration,
  onClear,
}: {
  board: WhiteboardData | null;
  narration: NarrationStep[] | null;
  onClear: () => void;
}) {
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [currentStep, setCurrentStep] = useState(0);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [revealedElementIndices, setRevealedElementIndices] = useState<number[] | null>(null);
  const [playbackError, setPlaybackError] = useState("");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const playbackSessionRef = useRef(0);
  const speechAvailable = useSyncExternalStore(
    subscribeToSpeechSupport,
    getSpeechSupportSnapshot,
    getSpeechSupportServerSnapshot,
  );
  const steps = narration ?? [];

  useEffect(() => {
    return () => {
      playbackSessionRef.current += 1;
      window.speechSynthesis?.cancel();
    };
  }, []);

  function speakStep(index: number, session: number) {
    if (session !== playbackSessionRef.current) return;
    if (index >= steps.length) {
      utteranceRef.current = null;
      setPlaybackState("ended");
      setActiveStep(null);
      setRevealedElementIndices(steps.flatMap((step) => step.elementIndices));
      return;
    }

    const utterance = new SpeechSynthesisUtterance(steps[index].text);
    utterance.lang = navigator.language;
    utterance.onstart = () => {
      if (session !== playbackSessionRef.current) return;
      setCurrentStep(index);
      setActiveStep(index);
      setRevealedElementIndices(getRevealedElementIndices(steps, index));
    };
    utterance.onend = () => {
      if (session !== playbackSessionRef.current) return;
      utteranceRef.current = null;
      speakStep(index + 1, session);
    };
    utterance.onerror = (event) => {
      if (session !== playbackSessionRef.current) return;
      utteranceRef.current = null;
      setPlaybackState("error");
      setActiveStep(null);
      setPlaybackError("Voice playback stopped. Try Play or Restart.");
      console.error("Speech synthesis failed.", event.error);
    };
    utteranceRef.current = utterance;
    try {
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      if (session !== playbackSessionRef.current) return;
      utteranceRef.current = null;
      setPlaybackState("error");
      setActiveStep(null);
      setPlaybackError("Could not start voice playback in this browser.");
      console.error("Could not start speech synthesis.", error);
    }
  }

  function startPlayback(index: number) {
    if (!speechAvailable || !steps.length) return;
    playbackSessionRef.current += 1;
    const session = playbackSessionRef.current;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setPlaybackState("playing");
    setPlaybackError("");
    setCurrentStep(index);
    setActiveStep(index);
    setRevealedElementIndices(getRevealedElementIndices(steps, index));
    speakStep(index, session);
  }

  function play() {
    if (!speechAvailable) return;
    if (playbackState === "paused") {
      resume();
      return;
    }
    startPlayback(playbackState === "ended" ? 0 : currentStep);
  }

  function pause() {
    if (!speechAvailable || playbackState !== "playing") return;
    window.speechSynthesis.pause();
    setPlaybackState("paused");
  }

  function resume() {
    if (!speechAvailable || playbackState !== "paused") return;
    setPlaybackError("");
    if (utteranceRef.current) {
      window.speechSynthesis.resume();
      setPlaybackState("playing");
    } else {
      startPlayback(currentStep);
    }
  }

  function restart() {
    if (speechAvailable) {
      startPlayback(0);
    } else {
      seekTo(0);
    }
  }

  function seekTo(index: number) {
    const nextStep = Math.max(0, Math.min(index, steps.length - 1));
    const wasPlaying = playbackState === "playing";
    const wasPaused = playbackState === "paused";
    playbackSessionRef.current += 1;
    const session = playbackSessionRef.current;
    if (speechAvailable) window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setCurrentStep(nextStep);
    setActiveStep(nextStep);
    setRevealedElementIndices(getRevealedElementIndices(steps, nextStep));
    setPlaybackError("");
    if (wasPlaying && speechAvailable) {
      setPlaybackState("playing");
      speakStep(nextStep, session);
    } else {
      setPlaybackState(wasPaused ? "paused" : "idle");
    }
  }

  const revealed = revealedElementIndices === null ? null : new Set(revealedElementIndices);
  const activeElements = activeStep === null ? new Set<number>() : new Set(steps[activeStep]?.elementIndices ?? []);
  const hasNarration = Boolean(board && steps.length > 0);
  const playbackStatus = !hasNarration
    ? "Ask a question to generate a narrated explanation."
    : playbackError ||
      (!speechAvailable
        ? "Voice playback is unavailable; use the slider to preview steps."
        : playbackState === "ended"
          ? "Narration complete."
          : "Voice is spoken by your browser.");

  return (
    <section className="whiteboard-panel" aria-label="Explanation whiteboard">
      <div className="whiteboard-header">
        <div>
          <h1>Whiteboard</h1>
          {board && <p>{board.title}{board.subtitle ? ` · ${board.subtitle}` : ""}</p>}
        </div>
        <button className="quiet-button clear-board" onClick={onClear} disabled={!board}>Clear</button>
      </div>
      <div className="narration-controls" role="group" aria-label="Narration controls">
        <div className="narration-buttons">
          {playbackState === "playing" && hasNarration ? (
            <button className="quiet-button narration-button" onClick={pause}>Pause</button>
          ) : playbackState === "paused" && hasNarration ? (
            <button className="quiet-button narration-button" onClick={resume}>Resume</button>
          ) : (
            <button className="quiet-button narration-button" onClick={play} disabled={!hasNarration || !speechAvailable}>Play</button>
          )}
          <button className="quiet-button narration-button" onClick={restart} disabled={!hasNarration || (!speechAvailable && currentStep === 0)}>Restart</button>
        </div>
        <label className="sr-only" htmlFor="narration-seek">Seek narration by step</label>
        <input
          id="narration-seek"
          className="narration-seek"
          type="range"
          min={0}
          max={Math.max(steps.length - 1, 0)}
          step={1}
          value={currentStep}
          onChange={(event) => seekTo(Number(event.target.value))}
          disabled={!hasNarration}
        />
        <span className="narration-step" aria-live="polite">{hasNarration ? `Step ${currentStep + 1} of ${steps.length}` : "No narration yet"}</span>
        <span className="narration-status" aria-live="polite">{playbackStatus}</span>
      </div>
      <div className="whiteboard-surface">
        <svg className="whiteboard-svg" viewBox="0 0 1000 700" role="img" aria-label={board ? `Diagram: ${board.title}. ${board.subtitle ?? ""}` : "Empty whiteboard. Ask a question to create an explanation diagram."}>
          <defs>
            <pattern id="board-grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="#e7e8e5" />
            </pattern>
            <marker id="board-arrowhead" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L7,3.5 L0,7 z" fill="currentColor" />
            </marker>
          </defs>
          <rect width="1000" height="700" fill="url(#board-grid)" />
          {board ? board.elements.map((element, index) => revealed && !revealed.has(index)
            ? null
            : <RenderElement element={element} index={index} active={activeElements.has(index)} key={index} />) : (
            <g className="board-empty">
              <text x="500" y="324" textAnchor="middle">Your whiteboard is empty</text>
              <text x="500" y="354" textAnchor="middle">Ask anything to build a visual explanation</text>
            </g>
          )}
        </svg>
      </div>
      <div className="whiteboard-footer">
        <span>{board ? "Diagram generated from the latest answer" : "Diagrams appear here as you chat"}</span>
        {board && <span>{board.elements.length} elements</span>}
      </div>
    </section>
  );
}
