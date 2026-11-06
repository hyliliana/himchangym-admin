"use client";
import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";

export type Api = <T = Record<string, unknown>>(
  path: string,
  method?: string,
  body?: unknown,
) => Promise<T>;
export const kstDate = (value = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
export const showTime = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
export const showHour = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
export const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
export function Notice({
  children,
  success = false,
}: {
  children: ReactNode;
  success?: boolean;
}) {
  return (
    <div
      className={`notice ${success ? "success" : "error"}`}
      role={success ? "status" : "alert"}
    >
      {children}
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function useResource<T>(
  api: Api,
  path: string | null,
  revision: number,
) {
  const key = `${path}:${revision}`;
  const [state, setState] = useState<{
    key: string;
    data: T | null;
    error: string;
    loading: boolean;
  }>({ key: "", data: null, error: "", loading: true });
  useEffect(() => {
    let active = true;
    if (!path) {
      setState({ key, data: null, error: "", loading: false });
      return;
    }
    setState({ key, data: null, error: "", loading: true });
    api<T>(path)
      .then((data) => {
        if (active) setState({ key, data, error: "", loading: false });
      })
      .catch((error) => {
        if (active)
          setState({
            key,
            data: null,
            error: error.message || "불러오지 못했어요.",
            loading: false,
          });
      });
    return () => {
      active = false;
    };
  }, [api, path, revision, key]);
  return state.key === key ? state : { data: null, error: "", loading: !!path };
}
export function Load({ loading, error }: { loading: boolean; error: string }) {
  return (
    <>
      {loading && (
        <p className="schedule-loading" role="status">
          불러오는 중이에요…
        </p>
      )}
      {error && <Notice>{error}</Notice>}
    </>
  );
}
export function Modal({
  title,
  children,
  close,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="닫기"
          disabled={busy}
          onClick={close}
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Form({
  children,
  onSubmit,
  submit = "저장",
  onBusyChange,
  submitDisabled = false,
}: {
  children: ReactNode;
  onSubmit: (form: FormData) => Promise<void>;
  submit?: string;
  onBusyChange?: (busy: boolean) => void;
  submitDisabled?: boolean;
}) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const data = new FormData(event.currentTarget);
    pending.current = true;
    setBusy(true);
    onBusyChange?.(true);
    setError("");
    try {
      await onSubmit(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : "다시 시도해 주세요.");
    } finally {
      pending.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  return (
    <form className="form" onSubmit={handle} aria-busy={busy}>
      <fieldset className="trainer-auth-fields" disabled={busy}>
        {children}
      </fieldset>
      {error && <Notice>{error}</Notice>}
      <button className="primary" disabled={busy || submitDisabled}>
        {busy ? "처리 중…" : submit}
      </button>
    </form>
  );
}

type Candidate = { startsAt: string; withinScope?: boolean };
export function CandidateCalendar({
  candidates,
  value,
  onChange,
  month,
  onMonthChange,
  busy = false,
}: {
  candidates: Candidate[];
  value: string;
  onChange: (value: string) => void;
  month: string;
  onMonthChange: (month: string) => void;
  busy?: boolean;
}) {
  const [selectedDate, setSelectedDate] = useState(
    value ? kstDate(new Date(value)) : "",
  );
  const grouped = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const day = kstDate(new Date(candidate.startsAt));
    grouped.set(day, [...(grouped.get(day) ?? []), candidate]);
  }
  const [year, monthNumber] = month.split("-").map(Number);
  const offset = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const dayCount = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const date = grouped.has(selectedDate) ? selectedDate : "";
  const moveMonth = (delta: number) => {
    const d = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
    onChange("");
    setSelectedDate("");
    onMonthChange(d.toISOString().slice(0, 7));
  };
  return (
    <div className="candidate-calendar">
      <div className="calendar-head">
        <button
          type="button"
          aria-label="이전 달"
          disabled={busy}
          onClick={() => moveMonth(-1)}
        >
          ‹
        </button>
        <strong>
          {year}년 {monthNumber}월
        </strong>
        <button
          type="button"
          aria-label="다음 달"
          disabled={busy}
          onClick={() => moveMonth(1)}
        >
          ›
        </button>
      </div>
      <div className="calendar-grid">
        {weekdays.map((day) => (
          <span className="calendar-weekday" key={day}>
            {day}
          </span>
        ))}
        {Array.from({ length: offset }, (_, index) => (
          <span key={`empty-${index}`} />
        ))}
        {Array.from({ length: dayCount }, (_, index) => {
          const key = `${month}-${String(index + 1).padStart(2, "0")}`;
          const available = grouped.has(key);
          return (
            <button
              type="button"
              key={key}
              disabled={!available || busy}
              aria-label={`${key}${available ? " 선택 가능" : " 선택 불가"}`}
              aria-pressed={date === key}
              className={date === key ? "selected" : ""}
              onClick={() => {
                setSelectedDate(key);
                onChange("");
              }}
            >
              {index + 1}
              {available && <span aria-hidden="true">·</span>}
            </button>
          );
        })}
      </div>
      <p className="help">
        선택 가능한 날짜만 활성화돼요. 표시 시간은 모두 한국 시간이에요.
      </p>
      {date && (
        <fieldset className="candidate-times">
          <legend>{date} 시간 선택</legend>
          {(grouped.get(date) ?? []).map((candidate) => (
            <label
              key={candidate.startsAt}
              className={value === candidate.startsAt ? "selected" : ""}
            >
              <input
                type="radio"
                name="candidate-time"
                checked={value === candidate.startsAt}
                disabled={busy}
                onChange={() => onChange(candidate.startsAt)}
              />
              <span>
                {showHour(candidate.startsAt)}
                {candidate.withinScope === false && (
                  <small>범위 밖 · 승인 필요</small>
                )}
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {!candidates.length && !busy && (
        <p className="help calendar-empty">
          이 달에는 등록 가능한 시간이 없어요. 다른 달을 확인해 주세요.
        </p>
      )}
    </div>
  );
}
