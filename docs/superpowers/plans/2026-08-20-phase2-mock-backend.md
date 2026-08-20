# Phase 2 Mock Backend Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic FastAPI backend that validates and streams the existing three-day Nanjing fixture through Pydantic contracts.

**Architecture:** Keep the backend to four focused modules: Pydantic contracts, concrete mock facts/adapters, pure planning/validation/compilation plus event orchestration, and FastAPI transport. Do not add provider protocols, factories, persistence, or frontend integration until a second implementation or a real consumer requires them.

**Tech Stack:** Python 3.14, FastAPI, Pydantic 2, Uvicorn, Pytest, NDJSON.

**Spec:** `docs/superpowers/specs/2026-08-20-phase2-mock-backend-design.md`

## Global Constraints

- The backend runs locally on port `8000`; the existing frontend remains on port `9090`.
- The first version supports China only and returns `UNSUPPORTED_REGION` with `暂不支持该地区，等待后续开发` for destinations outside the deterministic Nanjing fixture.
- Every coordinate crossing the map seam uses BD-09; provider facts are never fabricated by the model adapter.
- Pydantic models are the backend contract source; JSON field names use the architecture contract's camelCase names.
- The mock endpoint is deterministic and has no Baidu, AI, database, queue, login, or secret configuration.
- Do not add a provider Protocol or generic Adapter factory while only the mock implementations exist.
- Preserve all existing uncommitted frontend changes; stage only files belonging to the current task's commit.
- Follow TDD for every non-trivial behavior: write the smallest failing test, run it, implement the minimum, rerun the focused test, then commit.

---

## File map

| File | Responsibility |
| --- | --- |
| `backend/requirements.txt` | Runtime and focused-test dependencies for the local backend. |
| `backend/app/models.py` | Pydantic domain, request, error, health, schedule, and progress-event models. |
| `backend/app/mock_data.py` | Backend copy of the stable Nanjing fixture plus `MockMapAdapter` and `MockModelAdapter`. |
| `backend/app/planning.py` | Destination gate, plan assembly, pure validation, deterministic StoryCompiler, and event stream creation. |
| `backend/app/main.py` | FastAPI app and the two HTTP endpoints. |
| `backend/tests/test_planning.py` | Contract, adapter, planning, timeline, event, and HTTP tests. |
| `CONTEXT.md` | Current implementation facts and next milestone after the backend slice is verified. |
| `README.md` | Concise local backend run instructions and current status. |

The frontend files already modified in the worktree are not part of this plan.

---

### Task 1: Add backend dependencies and canonical Pydantic contracts

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/app/models.py`
- Create: `backend/tests/test_planning.py`

**Interfaces:**
- Produces `GeoPoint`, `VerifiedPoi`, `TripStop`, `RouteLeg`, `TripDay`, `PlanWarning`, `TripPlan`, `StoryCommand`, `StoryChapter`, `StoryTimeline`, `PlanningResult`, `TripRequest`, `ProposedStop`, `ProposedDay`, `ProposedSchedule`, `AppError`, `PlanningEvent`, and `HealthResponse`.
- All models accept Python snake_case names and serialize with the contract aliases: `recommendedStayMinutes`, `verifiedAt`, `fromPoiUid`, `toPoiUid`, `distanceMeters`, `durationSeconds`, `routeLegs`, `tripId`, `tripVersion`, `startMs`, `durationMs`, `requestId`, `mapMode`, and `modelMode`.
- `GeoPoint` accepts only `crs="BD09"`, `lng` in `[-180, 180]`, and `lat` in `[-90, 90]`.
- Positive quantity fields use Pydantic constraints rather than later ad-hoc checks.

Use these Python field names and JSON aliases so later tasks have one unambiguous contract:

| Model | Required fields |
| --- | --- |
| `VerifiedPoi` | `uid`, `name`, `address`, `point`, `opening_hours`, `recommended_stay_minutes`, `source`, `verified_at` |
| `TripStop` | `poi`, `arrival_time`, `departure_time`, `narration` |
| `RouteLeg` | `id`, `from_poi_uid`, `to_poi_uid`, `mode`, `distance_meters`, `duration_seconds`, `geometry` |
| `TripDay` | `day`, `title`, `summary`, `stops`, `route_legs` |
| `TripPlan` | `id`, `version`, `destination`, `summary`, `days`, `warnings` |
| `StoryCommand` | `id`, `chapter_id`, `type`, `start_ms`, `duration_ms`, `easing`, `payload` |
| `StoryChapter` | `id`, `title`, `start_ms`, `duration_ms`, `commands` |
| `StoryTimeline` | `trip_id`, `trip_version`, `duration_ms`, `chapters` |
| `TripRequest` | `destination`, `days`, optional `departure`, `start_date`, `interests`, `pace`, `budget`, `transport`, required `message` |
| `PlanningEvent` | `request_id`, `sequence`, `type`, `message`, optional `data`, `error` |

- [ ] **Step 1: Write the failing contract tests**

Add these focused checks to `backend/tests/test_planning.py`:

```python
import pytest
from pydantic import ValidationError

from backend.app.models import GeoPoint, PlanningEvent, TripRequest


def test_geo_point_rejects_non_bd09_and_serializes_contract_names():
    with pytest.raises(ValidationError):
        GeoPoint(lng=118.8, lat=32.0, crs="WGS84")

    point = GeoPoint(lng=118.8, lat=32.0, crs="BD09")
    assert point.model_dump() == {"lng": 118.8, "lat": 32.0, "crs": "BD09"}


def test_request_and_event_use_camel_case_json_aliases():
    request = TripRequest(destination="南京", days=3, message="我计划去南京玩三天")
    event = PlanningEvent(
        request_id="request-1",
        sequence=1,
        type="planning.started",
        message="开始规划",
    )

    assert request.destination == "南京"
    assert event.model_dump(by_alias=True, exclude_none=True) == {
        "requestId": "request-1",
        "sequence": 1,
        "type": "planning.started",
        "message": "开始规划",
    }


def test_request_rejects_non_positive_day_count():
    with pytest.raises(ValidationError):
        TripRequest(destination="南京", days=0, message="南京三日游")
```

- [ ] **Step 2: Run the contract tests and verify they fail**

Run:

```text
python -m pytest backend/tests/test_planning.py -k "geo_point or request" -q
```

Expected: collection fails with `ModuleNotFoundError` because `backend.app.models` does not exist.

- [ ] **Step 3: Add the minimal dependency file and models**

Create `backend/requirements.txt` with the packages used by the local app and tests:

```text
fastapi>=0.141,<1
pydantic>=2.13,<3
uvicorn>=0.52,<1
pytest>=8,<9
httpx>=0.27,<1
```

In `models.py`, use one shared configuration so aliases work for both input and output:

```python
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ContractModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class GeoPoint(ContractModel):
    lng: float = Field(ge=-180, le=180)
    lat: float = Field(ge=-90, le=90)
    crs: Literal["BD09"]
```

Add the remaining models with the exact fields from the design spec. Use `Literal` for `source`, `mode`, `pace`, `budget`, `easing`, and all event/command types; use aliases for camelCase fields; use `list[...]` with `min_length` where a playable object cannot be empty. Define `PlanningEvent.data` as `dict[str, Any] | None` and `PlanningEvent.error` as `AppError | None`, so final result and terminal error events stay structurally distinct.

- [ ] **Step 4: Run the focused contract tests and verify they pass**

Run:

```text
python -m pytest backend/tests/test_planning.py -k "geo_point or request" -q
```

Expected: all three contract tests pass.

- [ ] **Step 5: Commit the contract slice**

```text
git add backend/requirements.txt backend/app/models.py backend/tests/test_planning.py
git commit -m "feat: add backend pydantic contracts"
```

---

### Task 2: Add the deterministic Nanjing mock facts and adapters

**Files:**
- Modify: `backend/tests/test_planning.py`
- Create: `backend/app/mock_data.py`

**Interfaces:**
- `MockMapAdapter.calls: list[tuple[str, ...]]`
- `MockMapAdapter.search_pois(destination: str) -> list[VerifiedPoi]`
- `MockMapAdapter.route(from_poi_uid: str, to_poi_uid: str) -> RouteLeg`
- `MockModelAdapter.calls: list[str]`
- `MockModelAdapter.create_schedule(request: TripRequest, candidates: list[VerifiedPoi]) -> ProposedSchedule`
- The fixture uses the same stable UIDs, BD-09 points, route endpoints, and three-day ordering as `lib/trip/nanjing-fixture.ts`.

- [ ] **Step 1: Write failing adapter tests**

Append tests that prove the map facts are verified fixture data and the model cannot select an unknown UID:

```python
from backend.app.mock_data import MockMapAdapter, MockModelAdapter


def test_mock_map_returns_all_three_nanjing_days_as_fixture_facts():
    adapter = MockMapAdapter()
    pois = adapter.search_pois("南京")

    assert len(pois) == 9
    assert {poi.source for poi in pois} == {"fixture"}
    assert {poi.point.crs for poi in pois} == {"BD09"}


def test_mock_map_route_endpoints_match_requested_pois():
    adapter = MockMapAdapter()
    route = adapter.route(
        "fixture-nanjing-fuzimiao",
        "fixture-nanjing-zhonghuamen",
    )

    assert route.from_poi_uid == "fixture-nanjing-fuzimiao"
    assert route.to_poi_uid == "fixture-nanjing-zhonghuamen"
    assert route.geometry[0] == adapter.poi_by_uid[route.from_poi_uid].point
    assert route.geometry[-1] == adapter.poi_by_uid[route.to_poi_uid].point


def test_mock_model_schedule_uses_only_candidate_uids():
    map_adapter = MockMapAdapter()
    model_adapter = MockModelAdapter()
    candidates = map_adapter.search_pois("南京")
    schedule = model_adapter.create_schedule(
        TripRequest(destination="南京", days=3, message="南京三日游"),
        candidates,
    )

    candidate_uids = {poi.uid for poi in candidates}
    selected_uids = {
        stop.poi_uid
        for day in schedule.days
        for stop in day.stops
    }
    assert len(schedule.days) == 3
    assert selected_uids <= candidate_uids
```

- [ ] **Step 2: Run the adapter tests and verify they fail**

Run:

```text
python -m pytest backend/tests/test_planning.py -k "mock_map or mock_model" -q
```

Expected: collection fails because `backend.app.mock_data` does not exist.

- [ ] **Step 3: Implement the minimal fixture and concrete mock adapters**

Copy the nine POIs and six route legs from the existing deterministic fixture into immutable module constants, preserving these IDs:

```text
fixture-nanjing-fuzimiao
fixture-nanjing-zhonghuamen
fixture-nanjing-laomendong
fixture-nanjing-presidential-palace
fixture-nanjing-six-dynasties-museum
fixture-nanjing-museum
fixture-nanjing-xuanwu-lake
fixture-nanjing-jiming-temple
fixture-nanjing-taicheng
```

Use `MockMapAdapter.poi_by_uid` and `route_by_pair` dictionaries. Record calls before returning deep model copies. Raise a structured lookup error for unknown POI pairs instead of manufacturing a route. `MockModelAdapter` must verify every returned UID is in the candidate set before returning its `ProposedSchedule`; use the same three day titles, summaries, and grounded narration as the TypeScript fixture.

- [ ] **Step 4: Run the adapter tests and verify they pass**

Run:

```text
python -m pytest backend/tests/test_planning.py -k "mock_map or mock_model" -q
```

Expected: all adapter tests pass.

- [ ] **Step 5: Commit the fixture adapter slice**

```text
git add backend/app/mock_data.py backend/tests/test_planning.py
git commit -m "feat: add deterministic backend mock adapters"
```

---

### Task 3: Add pure plan validation and deterministic StoryCompiler

**Files:**
- Modify: `backend/tests/test_planning.py`
- Create: `backend/app/planning.py`

**Interfaces:**
- `class PlanningError(Exception): error: AppError`
- `validate_plan(plan: TripPlan, candidates: list[VerifiedPoi], expected_days: int) -> TripPlan`
- `compile_timeline(plan: TripPlan) -> StoryTimeline`
- Validation returns the same plan when valid and raises `PlanningError` with `code="PLAN_INCOMPLETE"` when playable invariants fail.
- The compiler returns a timeline whose `trip_id == plan.id` and `trip_version == plan.version`.

- [ ] **Step 1: Write failing validation and compiler tests**

Append these tests:

```python
from backend.app.planning import PlanningError, compile_timeline, validate_plan


def test_validate_plan_rejects_a_route_with_the_wrong_endpoint():
    map_adapter = MockMapAdapter()
    plan = build_fixture_plan_for_test(map_adapter)
    first_day = plan.days[0]
    bad_route = first_day.route_legs[0].model_copy(
        update={"to_poi_uid": "fixture-nanjing-laomendong"}
    )
    bad_day = first_day.model_copy(update={"route_legs": [bad_route, *first_day.route_legs[1:]]})
    bad_plan = plan.model_copy(update={"days": [bad_day, *plan.days[1:]]})

    with pytest.raises(PlanningError) as error:
        validate_plan(bad_plan, map_adapter.search_pois("南京"), expected_days=3)

    assert error.value.error.code == "PLAN_INCOMPLETE"


def test_compile_timeline_is_bound_to_the_exact_plan_identity():
    plan = build_fixture_plan_for_test(MockMapAdapter())
    timeline = compile_timeline(plan)

    assert timeline.trip_id == plan.id
    assert timeline.trip_version == plan.version
    route_ids = {route.id for day in plan.days for route in day.route_legs}
    command_route_ids = {
        command.payload["routeLegId"]
        for chapter in timeline.chapters
        for command in chapter.commands
        if command.type in {"route.draw", "route.follow"}
    }
    assert command_route_ids == route_ids
```

`build_fixture_plan_for_test` is a small test helper that assembles a plan from the mock adapter; it is not production code.

Add the helper before the tests that use it:

```python
def build_fixture_plan_for_test(adapter: MockMapAdapter) -> TripPlan:
    candidates = adapter.search_pois("南京")
    by_uid = {poi.uid: poi for poi in candidates}
    schedule = MockModelAdapter().create_schedule(
        TripRequest(destination="南京", days=3, message="南京三日游"),
        candidates,
    )
    days = []
    for proposed_day in schedule.days:
        stops = [
            TripStop(poi=by_uid[item.poi_uid], narration=item.narration)
            for item in proposed_day.stops
        ]
        route_legs = [
            adapter.route(left.poi.uid, right.poi.uid)
            for left, right in zip(stops, stops[1:])
        ]
        days.append(
            TripDay(
                day=proposed_day.day,
                title=proposed_day.title,
                summary=proposed_day.summary,
                stops=stops,
                route_legs=route_legs,
            )
        )
    return TripPlan(
        id="fixture-nanjing-3d",
        version=1,
        destination="南京",
        summary="用三天时间串联秦淮风光、民国城市记忆与玄武湖畔的南京城市故事。",
        days=days,
        warnings=[],
    )
```

- [ ] **Step 2: Run the pure planning tests and verify they fail**

Run:

```text
python -m pytest backend/tests/test_planning.py -k "validate_plan or compile_timeline" -q
```

Expected: collection fails because `backend.app.planning` does not exist.

- [ ] **Step 3: Implement validation and compilation**

Implement `PlanningError.__init__(self, error: AppError)` so it stores `self.error` and passes `error.message` to `Exception`. Implement `validate_plan` as a pure function. Check expected day count and day numbers, candidate UID membership, unique day content, positive fields, `crs == "BD09"`, route count `len(stops) - 1`, route endpoint identity, geometry endpoint equality, and unique route IDs. Raise `PlanningError(AppError(code="PLAN_INCOMPLETE", message="行程不完整，无法播放", retryable=False))`; do not repair the plan.

Implement `compile_timeline` with fixed deterministic rules:

```python
INTRO_DURATION_MS = 5_200
DAY_DURATION_MS = 13_800
CLOSING_DURATION_MS = 2_800
```

`compile_timeline(plan)` must return `StoryTimeline(trip_id=plan.id, trip_version=plan.version, duration_ms=total_duration_ms, chapters=chapters)` after creating an intro chapter, one chapter per plan day, and a closing chapter. Route commands use payload key `routeLegId`, POI commands use `poiUid`, and every command ID derives from stable plan/chapter/POI/route identifiers rather than randomness.

The implementation must not use wall-clock time or random IDs. For each day, emit a `poi.show` and `narration.show` for the first stop, a `route.draw` and `route.follow` for every route leg, a `poi.show` and narration for each destination stop, and a `chapter.pause`. Add the globe/projection/camera intro and closing narration so the result is playable by the current frontend StoryPlayer.

- [ ] **Step 4: Run the pure planning tests and verify they pass**

Run:

```text
python -m pytest backend/tests/test_planning.py -k "validate_plan or compile_timeline" -q
```

Expected: validation rejects the mutated endpoint and compilation covers every route ID.

- [ ] **Step 5: Commit the validation/compiler slice**

```text
git add backend/app/planning.py backend/tests/test_planning.py
git commit -m "feat: validate and compile backend trip plans"
```

---

### Task 4: Add planning orchestration, region gating, and progress events

**Files:**
- Modify: `backend/tests/test_planning.py`
- Modify: `backend/app/planning.py`

**Interfaces:**
- `plan_events(request: TripRequest, request_id: str | None = None, map_adapter: MockMapAdapter | None = None, model_adapter: MockModelAdapter | None = None) -> Iterator[PlanningEvent]`
- `plan_events` yields exactly one terminal event: `planning.completed` with `data` containing `PlanningResult`, or `planning.error` with `error` containing `AppError`.
- Sequence numbers start at `1` and increase by one for every yielded event.
- Unsupported destinations are rejected before calling either adapter.

- [ ] **Step 1: Write failing orchestration tests**

Append these tests:

```python
from backend.app.planning import plan_events


def test_nanjing_plan_emits_monotonic_progress_and_a_bound_result():
    events = list(
        plan_events(
            TripRequest(destination="南京", days=3, message="我计划去南京玩三天"),
            request_id="request-1",
        )
    )

    assert [event.sequence for event in events] == list(range(1, len(events) + 1))
    assert events[0].type == "planning.started"
    assert events[-1].type == "planning.completed"
    result = PlanningResult.model_validate(events[-1].data)
    assert result.plan.destination == "南京"
    assert result.timeline.trip_id == result.plan.id
    assert result.timeline.trip_version == result.plan.version


def test_unsupported_destination_never_calls_the_mock_adapters():
    map_adapter = MockMapAdapter()
    model_adapter = MockModelAdapter()
    events = list(
        plan_events(
            TripRequest(destination="东京", days=3, message="东京三日游"),
            request_id="request-2",
            map_adapter=map_adapter,
            model_adapter=model_adapter,
        )
    )

    assert events[-1].type == "planning.error"
    assert events[-1].error.code == "UNSUPPORTED_REGION"
    assert events[-1].error.message == "暂不支持该地区，等待后续开发"
    assert map_adapter.calls == []
    assert model_adapter.calls == []
```

- [ ] **Step 2: Run the orchestration tests and verify they fail**

Run:

```text
python -m pytest backend/tests/test_planning.py -k "plan_emits or unsupported_destination" -q
```

Expected: collection fails because `plan_events` is not defined.

- [ ] **Step 3: Implement the minimum deterministic orchestration**

Use a local event helper that creates `PlanningEvent` with the current `request_id`, the next integer `sequence`, a literal event `type`, a Chinese `message`, and optional `data` or `error`. The orchestration must:

1. Generate a request ID with `uuid4()` only when the caller did not provide one.
2. Emit `planning.started` and `destination.validated`.
3. Normalize `南京市` to `南京`; reject every other destination in this phase with the exact unsupported error before any adapter method call.
4. Call `search_pois`, emit `pois.found`, call `create_schedule`, and emit one `day.planned` per proposed day.
5. Resolve each adjacent proposed stop pair with `route`, assemble `TripPlan(id="fixture-nanjing-3d", version=1, destination="南京", summary="用三天时间串联秦淮风光、民国城市记忆与玄武湖畔的南京城市故事。", days=assembled_days, warnings=[])`, and emit `routes.calculated`.
6. Call `validate_plan`, emit `plan.validated`, call `compile_timeline`, emit `timeline.ready`, and emit `planning.completed` with `PlanningResult.model_dump(mode="json", by_alias=True)`.
7. Catch `PlanningError` and emit one `planning.error` event; catch unexpected exceptions as `INTERNAL_ERROR` without exposing exception text or secrets.

Keep the iterator synchronous because the fixture adapters are local and deterministic; `main.py` will wrap the iterator in a streaming response. Do not add sleeps to simulate progress.

- [ ] **Step 4: Run the orchestration tests and verify they pass**

Run:

```text
python -m pytest backend/tests/test_planning.py -k "plan_emits or unsupported_destination" -q
```

Expected: both tests pass and the final Nanjing event contains a playable, identity-matched result.

- [ ] **Step 5: Commit the orchestration slice**

```text
git add backend/app/planning.py backend/tests/test_planning.py
git commit -m "feat: stream deterministic planning progress"
```

---

### Task 5: Expose the health and NDJSON HTTP endpoints

**Files:**
- Modify: `backend/tests/test_planning.py`
- Create: `backend/app/main.py`

**Interfaces:**
- `app = FastAPI(title="Lumivo AI API", version="0.1.0")`
- `GET /api/v1/health -> HealthResponse` with `status="ok"`, `mapMode="fixture"`, and `modelMode="fixture"`.
- `POST /api/v1/trips/plan -> StreamingResponse` with `media_type="application/x-ndjson"`.
- Malformed bodies remain normal FastAPI validation responses; planning errors are terminal NDJSON events.

- [ ] **Step 1: Write failing HTTP tests**

Append these tests:

```python
import json

from fastapi.testclient import TestClient

from backend.app.main import app


client = TestClient(app)


def test_health_reports_fixture_modes_without_secrets():
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "mapMode": "fixture",
        "modelMode": "fixture",
    }


def test_plan_endpoint_returns_ndjson_completed_event():
    response = client.post(
        "/api/v1/trips/plan",
        json={
            "destination": "南京",
            "days": 3,
            "message": "我计划去南京玩三天",
        },
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/x-ndjson")
    events = [json.loads(line) for line in response.text.splitlines()]
    assert events[-1]["type"] == "planning.completed"
    assert events[-1]["data"]["timeline"]["tripId"] == events[-1]["data"]["plan"]["id"]


def test_plan_endpoint_streams_unsupported_region_error():
    response = client.post(
        "/api/v1/trips/plan",
        json={"destination": "东京", "days": 3, "message": "东京三日游"},
    )

    events = [json.loads(line) for line in response.text.splitlines()]
    assert events[-1]["type"] == "planning.error"
    assert events[-1]["error"]["code"] == "UNSUPPORTED_REGION"
```

- [ ] **Step 2: Run the HTTP tests and verify they fail**

Run:

```text
python -m pytest backend/tests/test_planning.py -k "health or endpoint" -q
```

Expected: collection fails because `backend.app.main` does not exist.

- [ ] **Step 3: Implement the FastAPI transport**

Use the smallest app surface:

```python
from uuid import uuid4

from fastapi import FastAPI
from fastapi.responses import StreamingResponse

from .models import HealthResponse, TripRequest
from .planning import plan_events

app = FastAPI(title="Lumivo AI API", version="0.1.0")


@app.get("/api/v1/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", map_mode="fixture", model_mode="fixture")


@app.post("/api/v1/trips/plan")
def plan(request: TripRequest) -> StreamingResponse:
    request_id = str(uuid4())

    def lines():
        for event in plan_events(request, request_id=request_id):
            yield event.model_dump_json(by_alias=True, exclude_none=True) + "\n"

    return StreamingResponse(lines(), media_type="application/x-ndjson")
```

Do not add CORS in this task because no browser client consumes the endpoint yet. Do not return provider keys or raw exception messages.

- [ ] **Step 4: Run the HTTP tests and verify they pass**

Run:

```text
python -m pytest backend/tests/test_planning.py -k "health or endpoint" -q
```

Expected: all three HTTP tests pass.

- [ ] **Step 5: Commit the HTTP slice**

```text
git add backend/app/main.py backend/tests/test_planning.py
git commit -m "feat: expose mock planning api"
```

---

### Task 6: Record the completed backend milestone and run the full checks

**Files:**
- Modify: `CONTEXT.md`
- Modify: `README.md`
- Test: `backend/tests/test_planning.py`

**Interfaces:**
- Documentation states that FastAPI mock planning and health endpoints exist locally.
- Documentation continues to state that live Baidu verification, AI integration, frontend TripClient, revision, persistence, and browser evidence are not implemented.

- [ ] **Step 1: Add the backend run and test commands to the docs**

Update `README.md` so the current status includes the local FastAPI fixture endpoint and the run commands:

```text
python -m uvicorn backend.app.main:app --port 8000
python -m pytest backend/tests
```

Update `CONTEXT.md` to mark “FastAPI skeleton and mock map/model Adapters” complete and make “TripClient + frontend/backend fixture integration” the next frontend milestone. Do not claim live provider or AI behavior.

- [ ] **Step 2: Run the backend suite**

Run:

```text
python -m pytest backend/tests -q
```

Expected: all backend tests pass.

- [ ] **Step 3: Run the existing frontend checks without creating a TypeScript cache**

Run:

```text
npm run lint
npx tsc --noEmit --incremental false
```

Expected: both commands pass. The existing environment may still prevent `next build` from writing `.next/cache`; if so, report that environment failure separately and do not change unrelated frontend code to work around it.

- [ ] **Step 4: Run a local endpoint smoke check**

Start the server in one terminal:

```text
python -m uvicorn backend.app.main:app --port 8000
```

In another terminal, verify both endpoints:

```text
curl http://127.0.0.1:8000/api/v1/health
curl -N -X POST http://127.0.0.1:8000/api/v1/trips/plan -H "content-type: application/json" -d "{\"destination\":\"南京\",\"days\":3,\"message\":\"我计划去南京玩三天\"}"
```

Expected: health reports fixture modes and the plan response ends with `planning.completed`.

- [ ] **Step 5: Review the final diff and commit the milestone docs**

Confirm `git status` still shows the pre-existing frontend work as unstaged/uncommitted, then run:

```text
git add CONTEXT.md README.md
git commit -m "docs: record mock backend milestone"
```

Do not stage `.next`, `tsconfig.tsbuildinfo`, `.env.local`, or any unrelated worktree file.

---

## Final verification checklist

- [ ] `python -m pytest backend/tests -q`
- [ ] `npm run lint`
- [ ] `npx tsc --noEmit --incremental false`
- [ ] Local health endpoint returns fixture modes.
- [ ] Local plan endpoint streams monotonic NDJSON and ends in `planning.completed` for Nanjing.
- [ ] Unsupported destination ends in `planning.error` with the exact Chinese message and zero provider calls.
- [ ] No live Baidu/AI behavior is described as implemented.
- [ ] Existing frontend changes remain untouched and unstaged.
