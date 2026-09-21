import type {
  StoryCommand,
  StoryTimeline,
  TripPlan,
} from "../trip/types.ts";

export type StoryPlayerStatus = "idle" | "paused" | "playing" | "completed";

export type ActiveNarration = {
  text: string;
  poiUid?: string;
};

export type StoryPlayerState = {
  status: StoryPlayerStatus;
  chapterIndex: number;
  chapterId: string | null;
  elapsedMs: number;
  totalMs: number;
  activeNarration: ActiveNarration | null;
};

export class StoryPlayerError extends Error {
  readonly code = "TIMELINE_MISMATCH";

  constructor() {
    super("StoryTimeline 与 TripPlan 的 id 或版本不匹配");
    this.name = "StoryPlayerError";
  }
}

type StoryPlayerInput = {
  plan: TripPlan;
  timeline: StoryTimeline;
};

type StateListener = (state: StoryPlayerState) => void;
type CommandListener = (command: StoryCommand) => void;

export type StoryPlayer = {
  load(input: StoryPlayerInput): void;
  play(): void;
  pause(): void;
  replay(): void;
  next(): void;
  previous(): void;
  seekChapter(index: number): void;
  advance(deltaMs: number): void;
  getState(): StoryPlayerState;
  subscribe(listener: StateListener): () => void;
};

const emptyState = (): StoryPlayerState => ({
  status: "idle",
  chapterIndex: 0,
  chapterId: null,
  elapsedMs: 0,
  totalMs: 0,
  activeNarration: null,
});

export function createStoryPlayer(onCommand?: CommandListener): StoryPlayer {
  let timeline: StoryTimeline | undefined;
  let commands: StoryCommand[] = [];
  let state = emptyState();
  const listeners = new Set<StateListener>();

  const notify = () => {
    const snapshot = getState();
    listeners.forEach((listener) => listener(snapshot));
  };

  const getChapterIndex = (elapsedMs: number) => {
    if (!timeline) {
      return 0;
    }

    return Math.max(
      0,
      timeline.chapters.findLastIndex((chapter) => chapter.startMs <= elapsedMs),
    );
  };

  const getActiveNarration = (
    chapterIndex: number,
    elapsedMs: number,
  ): ActiveNarration | null => {
    const chapter = timeline?.chapters[chapterIndex];
    const narration = commands.findLast(
      (command): command is StoryCommand<"narration.show"> =>
        command.type === "narration.show" &&
        command.chapterId === chapter?.id &&
        command.startMs <= elapsedMs,
    );

    return narration ? { ...narration.payload } : null;
  };

  const updatePosition = (elapsedMs: number) => {
    const chapterIndex = getChapterIndex(elapsedMs);
    state = {
      ...state,
      chapterIndex,
      chapterId: timeline?.chapters[chapterIndex]?.id ?? null,
      elapsedMs,
      activeNarration: getActiveNarration(chapterIndex, elapsedMs),
    };
  };

  const emitCommandsBetween = (fromMs: number, toMs: number) => {
    commands
      .filter((command) => command.startMs > fromMs && command.startMs <= toMs)
      .forEach((command) => onCommand?.(command));
  };

  const getState = (): StoryPlayerState => ({
    ...state,
    activeNarration: state.activeNarration
      ? { ...state.activeNarration }
      : null,
  });

  const seekChapter = (index: number) => {
    if (!timeline) {
      return;
    }

    const chapterIndex = Math.min(
      Math.max(Math.trunc(index), 0),
      timeline.chapters.length - 1,
    );
    const elapsedMs = timeline.chapters[chapterIndex].startMs;

    state = { ...state, status: "paused" };
    const resetCommand = commands.findLast(
      (command) => command.type === "stage.clear" && command.startMs <= elapsedMs,
    );
    if (resetCommand) {
      onCommand?.(resetCommand);
    }
    emitCommandsBetween(elapsedMs - 1, elapsedMs);
    updatePosition(elapsedMs);
    notify();
  };

  return {
    load({ plan, timeline: nextTimeline }) {
      if (nextTimeline.tripId !== plan.id || nextTimeline.tripVersion !== plan.version) {
        throw new StoryPlayerError();
      }

      timeline = nextTimeline;
      commands = timeline.chapters.flatMap((chapter) => chapter.commands);
      state = {
        ...emptyState(),
        status: "paused",
        totalMs: timeline.durationMs,
      };
      updatePosition(0);
      emitCommandsBetween(-1, 0);
      notify();
    },

    play() {
      if (timeline && state.status !== "completed") {
        state = { ...state, status: "playing" };
        notify();
      }
    },

    pause() {
      if (state.status === "playing") {
        state = { ...state, status: "paused" };
        notify();
      }
    },

    replay() {
      if (!timeline) {
        return;
      }

      state = { ...state, status: "playing" };
      updatePosition(0);
      emitCommandsBetween(-1, 0);
      notify();
    },

    next() {
      if (timeline && state.chapterIndex < timeline.chapters.length - 1) {
        seekChapter(state.chapterIndex + 1);
      }
    },

    previous() {
      if (timeline) {
        seekChapter(Math.max(0, state.chapterIndex - 1));
      }
    },

    seekChapter,

    advance(deltaMs) {
      if (!timeline || state.status !== "playing" || !Number.isFinite(deltaMs) || deltaMs <= 0) {
        return;
      }

      const elapsedMs = Math.min(state.elapsedMs + deltaMs, timeline.durationMs);
      emitCommandsBetween(state.elapsedMs, elapsedMs);
      updatePosition(elapsedMs);
      state = {
        ...state,
        status: elapsedMs >= timeline.durationMs ? "completed" : "playing",
      };
      notify();
    },

    getState,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
