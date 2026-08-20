# Lumivo AI Phase 2 Mock Backend Vertical Slice

Date: 2026-08-20

Status: Awaiting written review

## 1. Goal

Add the smallest useful FastAPI backend slice for the existing Nanjing fixture. The slice establishes Pydantic as the backend contract source, proves the planning orchestration and validation path, and exposes a streaming plan endpoint that can be connected to the existing frontend later.

The result remains deterministic and local. It does not claim live Baidu or AI support.

## 2. Scope

### Included

- A `backend/` FastAPI application runnable on port `8000`.
- Pydantic models for the canonical trip, story, request, error, and progress-event contracts.
- A deterministic Nanjing `MockMapAdapter` for fixture POIs and route legs.
- A deterministic `MockModelAdapter` that selects only returned fixture POI UIDs and supplies grounded narration.
- Pure plan validation for identity, BD-09 coordinates, route endpoints, positive durations, and completeness.
- Pure StoryTimeline compilation from the validated plan.
- `GET /api/v1/health`.
- `POST /api/v1/trips/plan` as `application/x-ndjson` with monotonic progress events and a terminal result or error event.
- Focused Pytest coverage for contracts, orchestration, validation, timeline identity, and unsupported destinations.

### Excluded

- Baidu POI or route calls.
- A real model provider or model credentials.
- The revision endpoint.
- Frontend `TripClient`, request form, local persistence, or CORS configuration.
- Database, authentication, queues, background work, and deployment configuration.

The frontend's current TypeScript fixture and uncommitted playback work remain unchanged in this slice. FastAPI's generated OpenAPI document is the input for the later frontend contract-generation step.

## 3. Module shape

Keep the implementation to four focused modules and one test module:

| File | Responsibility |
| --- | --- |
| `backend/app/models.py` | Pydantic domain and HTTP/event models. JSON uses the camelCase names from the architecture contract. |
| `backend/app/mock_data.py` | Nanjing fixture facts plus the two concrete mock adapters. No provider protocol is added until a second implementation exists. |
| `backend/app/planning.py` | Request normalization, region gate, orchestration, pure validation, deterministic StoryCompiler, and event creation. |
| `backend/app/main.py` | FastAPI app, health response, and NDJSON transport. It does not contain planning rules. |
| `backend/tests/test_planning.py` | Focused executable checks, including endpoint stream parsing. |

The backend fixture intentionally mirrors the existing stable UIDs, BD-09 points, route endpoints, and three-day story. It is a temporary language-boundary duplicate; it will be replaced or mechanically aligned when the frontend begins consuming the backend OpenAPI contract. No generic repository or adapter factory is introduced yet.

## 4. Request and planning flow

`POST /api/v1/trips/plan` follows this order:

1. Validate the request with Pydantic.
2. Normalize the destination and require the Phase 2 Nanjing fixture request: destination `南京`/`南京市` and three days.
3. Emit `planning.started` and `destination.validated`.
4. Ask `MockMapAdapter` for verified candidate POIs.
5. Emit `pois.found`.
6. Ask `MockModelAdapter` for a schedule containing only candidate UIDs and grounded narration.
7. Emit one `day.planned` event per day.
8. Resolve every consecutive stop pair through `MockMapAdapter` and emit `routes.calculated`.
9. Validate the assembled plan; emit `plan.validated`.
10. Compile a timeline bound to the exact plan ID and version; emit `timeline.ready`.
11. Emit `planning.completed` with the complete `PlanningResult`.

The stream contains one JSON object per line. Every event has `requestId`, a strictly increasing `sequence`, `type`, and Chinese `message`; `data` is omitted when not needed. A terminal error event contains an `AppError` and no partial plan is sent as playable output.

The mock backend treats destinations outside this fixture as unsupported for this phase. It emits `UNSUPPORTED_REGION` with `暂不支持该地区，等待后续开发` before calling either mock adapter. This is an explicit deterministic limitation, not a claim to be a general geographic classifier.

## 5. Canonical contracts and invariants

`models.py` mirrors the existing architecture contract: `GeoPoint`, `VerifiedPoi`, `TripStop`, `RouteLeg`, `TripDay`, `TripPlan`, `StoryCommand`, `StoryChapter`, `StoryTimeline`, `PlanningResult`, `TripRequest`, `AppError`, and `PlanningEvent`.

Validation rejects, rather than repairs:

- non-`BD09` points or out-of-range coordinates;
- unknown POI UIDs from the model schedule;
- missing or duplicated day content;
- route legs whose `fromPoiUid`/`toPoiUid` do not match adjacent stops;
- route geometry whose first or last point differs from its POI endpoint;
- non-positive stay, distance, or duration values;
- a timeline whose `tripId` or `tripVersion` differs from the validated plan.

The compiler uses fixed, short animation durations independent of real travel duration. It produces the same command IDs, chapter IDs, command order, and route references for the same plan ID and version.

## 6. Error behavior

- Malformed request bodies use FastAPI's normal validation response.
- Unsupported destinations terminate the NDJSON stream with `UNSUPPORTED_REGION` and `retryable: false`.
- Invalid mock/model/map data terminates with the matching structured planning error and never produces `planning.completed`.
- The mock path has no transient external calls, so it does not add retry or timeout machinery.
- No provider keys are read or logged.

## 7. Verification and acceptance

Run from the repository root:

```text
python -m pytest backend/tests
python -m uvicorn backend.app.main:app --port 8000
```

The focused suite must prove:

- valid Nanjing input yields a complete three-day `PlanningResult`;
- every emitted sequence is increasing and the final event is `planning.completed`;
- the result timeline identity matches the plan;
- every route command references a plan route;
- validator cases reject wrong CRS, unknown POIs, missing legs, and endpoint mismatches;
- a non-Nanjing request emits the required unsupported-region error and records zero mock-provider calls;
- health reports fixture map/model modes without secrets.

This slice is complete when those tests pass and the endpoint can be read as NDJSON locally. Browser integration evidence remains a later milestone.

## 8. Follow-up boundary

After this slice is accepted, the next small step is a frontend `TripClient` that consumes this endpoint and replaces the hard-coded fixture only behind an explicit fixture/backend mode. Real Baidu adapters, real model output, revision, persistence, and browser acceptance evidence remain separate milestones.
