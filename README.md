# Explainboard

**Ask anything. See the idea.** Explainboard is a visual study companion for self-directed secondary, university, and adult learners exploring unfamiliar ideas across subjects. Explanations pair a diagram with step-by-step narration that reveals and highlights the corresponding whiteboard elements.

## Product intent

Reading a clear answer can still leave a learner unsure whether they have built a useful mental model. Explainboard is designed around one focused loop: **ask → explain → see → hear → retrieve**. Each live tutor response pairs a plain-language explanation with a spatial diagram, synchronized narration, and one low-stakes question the learner can answer before revealing a sample answer.

The board is an explanatory sketch, not a source of verified measurements. The practice check is deliberately ungraded: the sample answer supports self-comparison without implying that a model can reliably score open-ended understanding. The product stays focused on one learner and one idea at a time; it is not a classroom management system, a saved notebook, or an authoritative reference.

## Run locally

Requires Node.js 20.9+ and npm.

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Enable live AI

Copy `.env.example` to `.env.local`, then configure an OpenAI-compatible chat-completions endpoint:

```env
TUTOR_API_URL=https://your-provider.example/v1/chat/completions
TUTOR_API_KEY=your-server-side-key
TUTOR_MODEL=your-model-name
# Optional: set for providers/models that support reasoning control.
TUTOR_REASONING_EFFORT=none
# Optional: enable strict schema output on supporting providers (for example OpenRouter).
TUTOR_USE_JSON_SCHEMA=true
```

Both additional settings are optional; omit them for providers that do not support these options. For OpenRouter reasoning models that spend the output budget on internal reasoning, `none` can leave room for the visible answer and diagram. Strict JSON schema mode helps providers that support structured outputs return the explanation, diagram, practice check, and narration mapping in the expected shape. Restart the dev server after changing the environment. The API key is used only on the server and must not be put in a `NEXT_PUBLIC_` variable. Every live response must contain a short explanation, a valid diagram, a bounded practice question with sample answer, and narration steps mapped to the diagram. The app validates all of these before display.

Without these settings, the app explains how to configure the tutor. It does not return hard-coded answers or label scripted content as AI.

## Explore the learning loop

1. Ask a question from any subject. The narration panel is visible on the whiteboard; its controls become active when an answer is ready.
2. Read the answer and press **Play** to hear each narration segment reveal and highlight its diagram elements.
3. Use **Pause**, **Resume**, **Restart**, or the step slider to control the narration. Seeking selects a narrated step, not an arbitrary time within audio.
4. Try the short understanding check in your own words, then expand “Compare with a sample answer.”
5. Ask a follow-up; up to eight prior user/assistant messages are sent as context. Practice drafts are not sent.
6. Start a new chat to clear the conversation, practice checks, narration, and diagram.

## Implementation

- **Chat:** current-tab in-memory messages, IME-safe Enter-to-send, loading and error states, and a client-only draft for each practice check.
- **Whiteboard:** responsive SVG canvas with validated text, connectors, boxes, circles, and smooth open/closed freeform paths for curves and hand-drawn shapes.
- **Narration:** ordered, validated speech segments reference whiteboard element indexes. Browser speech synthesis speaks each segment while its elements are revealed and highlighted; playback has Play, Pause, Resume, Restart, and step-seek controls.
- **AI:** server-side, OpenAI-compatible API adapter; each response proposes an explanation, mapped narration, diagram, and sample answer. The app does not score learner drafts or execute model-generated code or markup.
- **Validation:** bounded input and history, bounded output text and diagram element count, coordinate and shape constraints, fixed color tones.
- **Unavailable state:** without credentials, question submission returns a clear setup message.

See [implementation.md](./implementation.md) for the end-to-end architecture, flow diagram, request/response contract, operations, and verification guide.

## Checks

```bash
npm run lint
npm test
npx tsc --noEmit
npm run build
```

## Privacy and limitations

There are no accounts or server-side learner profiles. With live AI enabled, the current question and up to eight prior user/assistant messages are sent to the configured provider; practice drafts remain in browser memory and are not sent. Narration text comes from the model; the app makes no separate text-to-speech API request. Browser and operating-system speech engines control how voice processing is handled. Do not enter sensitive personal data. Sample answers and diagrams are model-generated and can be wrong; practice is not graded. Voice availability, pronunciation, and voice selection depend on the browser and operating system. Seeking is by narrated step, not an arbitrary audio timestamp. The whiteboard uses a fixed set of safe SVG primitives; it does not interpret uploaded images or provide a user-operated freehand drawing tool. The prototype has no production rate limiter and is an educational aid rather than an authoritative source.

## Evaluation evidence

| Framework dimension | Evidence in this submission |
|---|---|
| Product understanding and problem framing | Defines the self-directed learner, the uncertainty after passive reading, and a bounded explain–visualize–retrieve loop. |
| Originality and product thinking | Combines cross-subject explanations, synchronized visual narration, freeform-capable sketches, and ungraded retrieval practice while avoiding an unnecessary LMS or score. |
| Engineering and problem-solving | Bounded API inputs, timeouts, retries for invalid diagrams, narration-to-element validation, safe SVG rendering, and responsive viewport sizing. |
| AI integration and application | Live server-side provider configuration, structured response contract, no scripted success fallback, and explicit model limitations. |
| Teaching and interaction quality | Learners can hear and follow the visual sequence, attempt a short check, and compare with a sample answer without disclosing their draft. |
| Code quality and technical decisions | Small Next.js application, shared types/validators, focused tests, and documented trade-offs. |
| Documentation and communication | This README describes the product and review flow; [implementation.md](./implementation.md) documents setup, architecture, data flow, verification, privacy, and limitations. |

## Assignment submission status

This checkout does not have a published GitHub repository or live demo URL configured, and the external submission form has not been completed. Those are release steps outside the source code. Before submitting, publish the repository, deploy the app with its server-only provider settings, provide the real demo URL and access instructions, and complete the [official assignment form](https://docs.google.com/forms/d/e/1FAIpQLSdFJoTxMEuFZrCHTbEgv7bbg2uLf33SjP7n0w2qUONR4kMRcA/viewform?usp=publish-editor). Do not use a committed key or a fake/simulated demo.
