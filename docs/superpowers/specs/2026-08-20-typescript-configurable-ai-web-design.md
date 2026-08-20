# Lumivo AI TypeScript Configurable AI Web Design

Date: 2026-08-20

Status: Awaiting written review

## 1. Purpose

Replace the unfinished Python backend direction with a small TypeScript AI web slice. The user can ask for travel advice for any destination in China and receive a Chinese response from a configured chat-completions provider.

This is an AI interaction prototype, not the verified itinerary system described by the earlier map architecture. It does not train a model, persist conversations, or claim provider-verified coordinates, routes, distances, or durations.

## 2. Scope

### Included

- A TypeScript Node backend under `backend/`, running locally on port `8000`.
- A `GET /health` endpoint that reports server readiness and configured model name without exposing credentials.
- A `POST /api/chat` endpoint accepting a message and bounded conversation history.
- A single OpenAI-compatible Chat Completions client configured at runtime by environment variables.
- DeepSeek as the default local configuration, while allowing other OpenAI-compatible providers by changing `baseURL`, key, and model.
- Server-side timeout, request-size validation, provider-error normalization, and no secret logging.
- A basic Chinese chat page at `/ai` with input, send, loading, error, and conversation states.
- Unit tests for config validation, request construction, response parsing, timeout/error mapping, and chat input limits.

### Excluded

- Python, FastAPI, database, login, cloud sync, model training, RAG, tools, agents, and background jobs.
- Streaming/SSE responses; the first slice returns one complete answer.
- Provider-specific APIs that are not OpenAI-compatible. They can be added later as explicit adapters after a real provider requires one.
- Map POI lookup, route geometry, coordinates, live opening hours, or claims of provider verification.
- Replacing the existing map homepage. The chat page is a separate route at `/ai`.

The incomplete Python files and the obsolete Python Phase 2 design/plan are removed from this branch before the TypeScript implementation is committed. Existing user-authored frontend and dependency changes remain intact.

## 3. Runtime configuration

The backend reads only local ignored environment files. It supports these names:

```text
AI_BASE_URL=https://api.deepseek.com
AI_API_KEY=
AI_MODEL=deepseek-chat
AI_TIMEOUT_MS=30000
CORS_ORIGIN=http://localhost:8989
```

For the currently configured DeepSeek setup, `DEEPSEEK_API_KEY` is accepted as a fallback when `AI_API_KEY` is absent. `AI_API_KEY` takes precedence so switching providers does not require changing application code. The browser receives none of these values.

The provider client posts to `${AI_BASE_URL}/chat/completions` with the configured bearer token and model. `AI_BASE_URL` is normalized so a trailing slash does not create a double slash. A missing key is reported as a local configuration error when a chat request is made; `/health` remains usable for diagnostics.

## 4. Backend modules

Keep the backend to four small modules:

| File | Responsibility |
| --- | --- |
| `backend/types.ts` | Chat request, message, response, provider error, and health types. |
| `backend/config.ts` | Read and validate runtime configuration; never log the key. |
| `backend/ai-client.ts` | Build the system prompt, call the OpenAI-compatible endpoint through injected `fetch`, enforce timeout, and normalize responses/errors. |
| `backend/server.ts` | Native Node HTTP transport, JSON parsing, CORS, routes, body-size limit, and response status. |

No Express, provider factory, LangChain chain, or generic repository is needed for one compatible wire protocol. The existing LangChain dependency changes are preserved but are not used by this minimal slice.

## 5. HTTP contracts

### `POST /api/chat`

Request:

```ts
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatRequest = {
  message: string;
  history?: ChatMessage[];
  destination?: string;
  days?: number;
};
```

Rules:

- `message` is trimmed and must contain 1–4000 characters.
- `history` contains at most 20 messages, each with at most 4000 characters.
- `destination`, when present, is a user hint only; it does not authorize fabricated map facts.
- `days`, when present, is an integer from 1 to 30.
- Client history cannot contain a `system` message; the backend owns the system prompt.

Success response:

```json
{
  "message": {
    "role": "assistant",
    "content": "..."
  }
}
```

Expected errors use:

```json
{
  "error": {
    "code": "INVALID_REQUEST | AI_NOT_CONFIGURED | AI_PROVIDER_ERROR | AI_PROVIDER_TIMEOUT | INTERNAL_ERROR",
    "message": "用户可读的中文说明"
  }
}
```

### `GET /health`

Returns `{ "status": "ok", "model": "configured-model" }`. It must not return a key, full base URL, authorization header, or raw provider response.

## 6. AI behavior

The backend prepends a fixed Chinese system instruction:

- act as a practical China travel assistant for arbitrary Chinese destinations;
- use the user's destination, days, and preferences as planning context;
- clearly label assumptions and ask for missing preferences when useful;
- never invent coordinates, Baidu UIDs, route geometry, distances, durations, opening hours, or live availability;
- explain that map verification is not yet connected when the user asks for exact map facts;
- return concise, readable Chinese suitable for the chat page.

The user history is appended after this system message. The server sends one provider request and returns the first text content in `choices[0].message.content`. Missing or non-string provider content is an `AI_PROVIDER_ERROR`, never an empty successful answer.

## 7. Frontend flow

`app/ai/page.tsx` remains a server composition page and renders a client `AiChat` component. `AiChat` keeps messages in React state, posts only the user message plus bounded history to `NEXT_PUBLIC_AI_BACKEND_URL` (default `http://localhost:8000`), and renders the returned assistant message.

The page uses semantic labels, a real form, keyboard submission, disabled loading controls, `aria-live` for errors and new replies, and a clear Chinese message when the backend is unavailable. It does not read `AI_API_KEY` or any server-only variable.

## 8. Error and security rules

- Parse and validate JSON before calling the provider.
- Limit request bodies to 64 KiB.
- Abort provider requests after `AI_TIMEOUT_MS` using `AbortController`.
- Map non-2xx provider responses to `AI_PROVIDER_ERROR` without returning the provider body.
- Never log request history, API keys, authorization headers, or full provider responses.
- Allow CORS only for `CORS_ORIGIN`; handle `OPTIONS` without calling the model.
- No provider call happens for invalid requests or missing configuration.

## 9. Verification

Run:

```text
npm run backend:test
npm run backend:typecheck
npm run lint
npx tsc --noEmit --incremental false
```

The automated tests use an injected fake `fetch` and never spend provider quota. A local health smoke check proves the server starts without a provider call. A live DeepSeek request is optional manual evidence and is not required for the deterministic test suite.

The slice is complete when `/ai` renders, invalid input is rejected locally, a fake provider response is displayed through the endpoint contract, and the existing map/story tests remain green.

## 10. Follow-up boundary

The next separate slice may add streaming, structured itinerary output, verified POI/route providers, or provider-specific adapters. None of those concerns should enter this basic chat implementation before a real requirement exists.
