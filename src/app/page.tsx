"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { Whiteboard } from "@/components/whiteboard";
import { isTutorReply, type TutorPractice, type Whiteboard as WhiteboardData } from "@/lib/whiteboard";

type Message = {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  practice?: TutorPractice;
};
type ServiceMode = "checking" | "ready" | "setup";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [board, setBoard] = useState<WhiteboardData | null>(null);
  const [question, setQuestion] = useState("");
  const [serviceMode, setServiceMode] = useState<ServiceMode>("checking");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/health")
      .then(async (response) => {
        if (!response.ok) throw new Error("Health check failed.");
        return response.json() as Promise<{ tutorConfigured?: boolean }>;
      })
      .then((health) => {
        if (active) setServiceMode(health.tutorConfigured ? "ready" : "setup");
      })
      .catch(() => {
        if (active) setServiceMode("setup");
      });
    return () => {
      active = false;
      controllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  async function sendQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = question.trim();
    if (!prompt || sending) return;

    const priorHistory = messages
      .filter((message): message is Message & { role: "user" | "assistant" } => message.role !== "error")
      .slice(-8)
      .map((message) => ({ role: message.role, content: message.content }));
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: prompt }]);
    setQuestion("");
    setSending(true);

    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const response = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ question: prompt, history: priorHistory }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const reason = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "The tutor could not answer that right now.";
        throw new Error(reason);
      }
      if (!isTutorReply(payload)) throw new Error("The tutor returned a response that could not be displayed safely. Please try again.");
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: payload.message,
        practice: payload.practice,
      }]);
      setBoard(payload.board);
    } catch (error) {
      if (controllerRef.current !== controller) return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      const detail = error instanceof Error ? error.message : "The tutor could not answer that right now.";
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "error", content: detail }]);
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setSending(false);
      }
    }
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || event.repeat) return;
    event.currentTarget.form?.requestSubmit();
  }

  function startNewChat() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setMessages([]);
    setBoard(null);
    setQuestion("");
    setSending(false);
    questionRef.current?.focus();
  }

  const statusLabel = serviceMode === "checking" ? "Checking" : serviceMode === "ready" ? "AI ready" : "AI setup needed";
  return (
    <main className="app-shell">
      <header className="app-header">
        <Link className="brand" href="/" aria-label="Explainboard home">
          <span className="brand-mark" aria-hidden="true">E</span>
          <span>Explainboard</span>
        </Link>
        <div className="header-actions">
          <span className={`service-status ${serviceMode}`}>
            <span className="service-indicator" />
            {statusLabel}
          </span>
          <button className="quiet-button new-chat-button" onClick={startNewChat}>New chat</button>
        </div>
      </header>

      <div className="workspace">
        <section className="chat-panel" aria-label="Chat with the tutor">
          <header className="chat-heading">
            <div>
              <h1>Ask anything</h1>
              <p>Get a clear answer and a diagram on the board.</p>
            </div>
          </header>

          <div className="conversation" aria-live="polite" aria-label="Conversation">
            {messages.length === 0 ? (
              <div className="chat-empty">
                <span className="empty-mark" aria-hidden="true">E</span>
                <h2>What would you like to understand?</h2>
                <p>Ask about any subject. Your explanation will take shape on the whiteboard.</p>
              </div>
            ) : (
              <div className="message-list">
                {messages.map((message) => (
                  <article key={message.id} className={`message ${message.role}`}>
                    {message.role === "assistant" && <span className="message-mark" aria-hidden="true">E</span>}
                    <div className="message-content">
                      {message.role === "assistant" && <span className="message-label">EXPLAINER</span>}
                      <p>{message.content}</p>
                      {message.role === "assistant" && message.practice && <PracticeCheck practice={message.practice} />}
                    </div>
                  </article>
                ))}
                {sending && (
                  <div className="message assistant" role="status">
                    <span className="message-mark" aria-hidden="true">E</span>
                    <div className="message-content"><span className="message-label">THINKING</span><div className="typing-indicator"><i /><i /><i /></div></div>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            )}
          </div>

          <form className="composer" onSubmit={sendQuestion}>
            <label className="sr-only" htmlFor="question">Your question</label>
            <textarea
              ref={questionRef}
              id="question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={onComposerKeyDown}
              placeholder="Ask a question…"
              maxLength={1200}
              rows={2}
              disabled={sending}
            />
            <div className="composer-footer">
              <span>Enter to send · Shift + Enter for a new line</span>
              <button className="send-button" type="submit" disabled={!question.trim() || sending} aria-label="Send question">
                {sending ? <span className="send-spinner" aria-hidden="true" /> : <SendIcon />}
                <span>{sending ? "Thinking" : "Send"}</span>
              </button>
            </div>
          </form>
        </section>

        <Whiteboard board={board} onClear={() => setBoard(null)} />
      </div>
      <footer className="app-footer">
        <span>Answers may be imperfect. Ask follow-up questions to explore an idea.</span>
        <span>Conversation stays in this tab.</span>
      </footer>
    </main>
  );
}

function PracticeCheck({ practice }: { practice: TutorPractice }) {
  const [draft, setDraft] = useState("");
  const answerId = useId();

  return (
    <section className="practice-check" aria-label="Quick understanding check">
      <span className="message-label">TRY IT</span>
      <p className="practice-question">{practice.question}</p>
      <label className="practice-label" htmlFor={answerId}>Your answer (optional)</label>
      <textarea
        id={answerId}
        className="practice-draft"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        maxLength={500}
        rows={2}
        placeholder="Write what you remember…"
      />
      <span className="practice-note">Your draft stays in this tab and is not sent.</span>
      <details className="practice-reveal">
        <summary>Compare with a sample answer</summary>
        <p>{practice.answer}</p>
      </details>
    </section>
  );
}

function SendIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 8h10M8 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
