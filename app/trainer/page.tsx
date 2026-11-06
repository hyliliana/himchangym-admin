"use client";
import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Reservation, User } from "../../lib/types";

type Filter = "pending" | "approved" | "completed" | "all";
const filters: Record<Filter, string> = {
  pending: "승인 대기",
  approved: "예정 수업",
  completed: "완료 · PT 피드백",
  all: "전체 기록",
};
const states = {
  booked: "예약 확정",
  completed: "수업 완료",
  cancelled: "취소",
  noshow: "노쇼",
};
const time = (s: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(s));
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
function Brand() {
  return (
    <a className="brand" href="/trainer">
      <img
        className="brand-symbol"
        src="/brand/himchangym-symbol.svg"
        alt=""
        width="32"
        height="32"
      />
      <b className="brand-label">
        힘찬짐<small>트레이너</small>
      </b>
    </a>
  );
}
function Notice({
  children,
  success = false,
}: {
  children: ReactNode;
  success?: boolean;
}) {
  return (
    <div
      role={success ? "status" : "alert"}
      className={`notice ${success ? "success" : "error"}`}
    >
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
async function api<T = Record<string, unknown>>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/trainer-api/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const data = await response
    .json()
    .catch(() => ({
      message: "응답을 확인하지 못했어요. 다시 시도해 주세요.",
    }));
  if (!response.ok) {
    if (
      response.status === 401 &&
      !["auth/login", "auth/me", "auth/change-password"].includes(path)
    )
      window.dispatchEvent(new Event("gym-trainer-unauthorized"));
    throw new Error(data.message || "처리하지 못했어요. 다시 시도해 주세요.");
  }
  return data;
}
function AuthForm({
  submit,
  children,
  onSubmit,
}: {
  submit: string;
  children: ReactNode;
  onSubmit: (data: FormData) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = useRef(false);
  async function handle(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await onSubmit(new FormData(e.currentTarget));
    } catch (e) {
      setError(e instanceof Error ? e.message : "다시 시도해 주세요.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <form className="form" onSubmit={handle} aria-busy={busy}>
      <fieldset className="trainer-auth-fields" disabled={busy}>
        {children}
      </fieldset>
      {error && <Notice>{error}</Notice>}
      <button className="primary full" disabled={busy}>
        {busy ? "처리 중…" : submit}
      </button>
    </form>
  );
}
function Status({ reservation: r }: { reservation: Reservation }) {
  const approval = r.approval ?? "approved";
  return (
    <span
      className={`badge ${approval === "pending" ? "pending" : approval === "rejected" ? "cancelled" : r.status}`}
    >
      {approval === "pending" && r.status === "booked"
        ? "승인 대기"
        : approval === "rejected"
          ? "승인 거절"
          : states[r.status]}
    </span>
  );
}
export default function TrainerPage() {
  const [user, setUser] = useState<User | null>(null),
    [boot, setBoot] = useState(true),
    [message, setMessage] = useState("");
  useEffect(() => {
    api<{ user: User }>("auth/me")
      .then((d) => {
        if (d.user.kind === "trainer") setUser(d.user);
      })
      .catch(() => {})
      .finally(() => setBoot(false));
    const unauthorized = () => {
      setUser(null);
      setMessage("로그인이 만료됐어요. 다시 로그인해 주세요.");
    };
    window.addEventListener("gym-trainer-unauthorized", unauthorized);
    return () =>
      window.removeEventListener("gym-trainer-unauthorized", unauthorized);
  }, []);
  async function logout() {
    try {
      await api("auth/logout", "POST", {});
    } catch {
    } finally {
      setUser(null);
      setMessage("로그아웃했어요.");
    }
  }
  if (boot)
    return (
      <main className="auth-shell">
        <p role="status">트레이너 화면을 준비하고 있어요…</p>
      </main>
    );
  if (!user)
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <Brand />
          <h1>
            회원의 변화를 만드는
            <br />
            오늘의 수업
          </h1>
          <p className="muted">
            트레이너 전용 로그인입니다. 담당 수업을 확인하고 예약을 승인해
            주세요.
          </p>
          {message && <Notice success>{message}</Notice>}
          <AuthForm
            submit="트레이너 로그인"
            onSubmit={async (f) => {
              const d = await api<{ user: User }>("auth/login", "POST", {
                email: f.get("email"),
                password: f.get("password"),
                kind: "trainer",
              });
              if (d.user.kind !== "trainer")
                throw new Error("트레이너 계정으로 로그인해 주세요.");
              setUser(d.user);
              setMessage("");
            }}
          >
            <Field label="이메일">
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                maxLength={254}
              />
            </Field>
            <Field label="비밀번호">
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
              />
            </Field>
          </AuthForm>
          <p className="help">
            계정이 없거나 비밀번호를 잊으셨다면 마스터 관리자에게 문의해 주세요.
          </p>
          <a className="auth-switch" href="/">
            마스터 관리자 · 부운영자 로그인
          </a>
        </div>
      </main>
    );
  if (user.mustChangePassword)
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <Brand />
          <h1>
            새 비밀번호를
            <br />
            설정해 주세요
          </h1>
          <p className="muted">
            첫 로그인입니다. 비밀번호를 변경하면 담당 수업을 확인할 수 있어요.
          </p>
          <AuthForm
            submit="비밀번호 변경"
            onSubmit={async (f) => {
              if (f.get("newPassword") !== f.get("confirmPassword"))
                throw new Error("새 비밀번호가 일치하지 않아요.");
              const d = await api<{ user: User }>(
                "auth/change-password",
                "POST",
                {
                  currentPassword: f.get("currentPassword"),
                  newPassword: f.get("newPassword"),
                },
              );
              setUser(d.user);
            }}
          >
            <Field label="현재 임시 비밀번호">
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
              />
            </Field>
            <Field label="새 비밀번호 (8자 이상)">
              <input
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
              />
            </Field>
            <Field label="새 비밀번호 확인">
              <input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
              />
            </Field>
          </AuthForm>
          <button className="text-button logout-alone" onClick={logout}>
            로그아웃
          </button>
        </div>
      </main>
    );
  return <TrainerLessons user={user} logout={logout} />;
}
function TrainerLessons({ user, logout }: { user: User; logout: () => void }) {
  const [reservations, setReservations] = useState<Reservation[]>([]),
    [filter, setFilter] = useState<Filter>("pending"),
    [date, setDate] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [revision, setRevision] = useState(0),
    [selected, setSelected] = useState<Reservation | null>(null);
  const refresh = useCallback((text: string) => {
    setSelected(null);
    setMessage(text);
    setRevision((v) => v + 1);
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setReservations([]);
    api<{ reservations: Reservation[] }>("trainer/reservations")
      .then((d) => {
        if (active) setReservations(d.reservations);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  const pending = reservations.filter(
    (r) => r.status === "booked" && r.approval === "pending",
  );
  const approved = reservations.filter(
    (r) => r.status === "booked" && (r.approval ?? "approved") === "approved",
  );
  const completed = reservations.filter((r) => r.status === "completed");
  const visible = (
    filter === "pending"
      ? pending
      : filter === "approved"
        ? approved
        : filter === "completed"
          ? completed
          : reservations
  )
    .filter(
      (r) =>
        !date ||
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Seoul",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(r.startsAt)) === date,
    )
    .sort((a, b) =>
      filter === "completed" || filter === "all"
        ? Date.parse(b.startsAt) - Date.parse(a.startsAt)
        : Date.parse(a.startsAt) - Date.parse(b.startsAt),
    );
  return (
    <div className="trainer-shell">
      <header className="trainer-header">
        <Brand />
        <div>
          <strong>{user.name} 트레이너</strong>
          <button onClick={logout}>로그아웃</button>
        </div>
      </header>
      <main className="trainer-main">
        <header className="page-head">
          <div>
            <p className="eyebrow">{today()} · 한국 시간</p>
            <h1>담당 수업</h1>
            <p className="muted">
              예약을 확인하고 수업 후 PT 피드백을 남겨 주세요.
            </p>
          </div>
          <button onClick={() => setRevision((v) => v + 1)} disabled={loading}>
            새로고침
          </button>
        </header>
        {message && <Notice success>{message}</Notice>}
        <div className="metrics">
          <section>
            <span>승인 대기</span>
            <strong>
              {loading ? "—" : pending.length}
              <small>건</small>
            </strong>
          </section>
          <section>
            <span>예정 수업</span>
            <strong>
              {loading ? "—" : approved.length}
              <small>건</small>
            </strong>
          </section>
          <section>
            <span>완료 수업</span>
            <strong>
              {loading ? "—" : completed.length}
              <small>건</small>
            </strong>
          </section>
        </div>
        <nav className="trainer-tabs" aria-label="수업 목록">
          {Object.entries(filters).map(([key, label]) => (
            <button
              key={key}
              aria-current={filter === key ? "page" : undefined}
              className={filter === key ? "active" : ""}
              onClick={() => setFilter(key as Filter)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="trainer-filter">
          <Field label="수업일">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          {date && <button onClick={() => setDate("")}>전체 날짜</button>}
          <span className="help">
            {!loading && !error && `${visible.length}건 · 한국 시간 기준`}
          </span>
        </div>
        {loading && (
          <p className="trainer-loading" role="status">
            담당 수업을 불러오고 있어요…
          </p>
        )}
        {error && (
          <>
            <Notice>{error}</Notice>
            <button onClick={() => setRevision((v) => v + 1)}>
              다시 불러오기
            </button>
          </>
        )}
        {!loading && !error && !visible.length && (
          <section className="card empty">
            {date
              ? "선택한 날짜에 수업이 없어요."
              : filter === "pending"
                ? "승인을 기다리는 예약이 없어요."
                : filter === "approved"
                  ? "예정된 수업이 없어요."
                  : filter === "completed"
                    ? "완료한 수업이 없어요."
                    : "아직 담당 수업이 없어요."}
          </section>
        )}
        <div className="trainer-lessons">
          {visible.map((r) => (
            <article className="card trainer-lesson" key={r.id}>
              <div className="trainer-lesson-head">
                <time dateTime={r.startsAt}>{time(r.startsAt)}</time>
                <Status reservation={r} />
              </div>
              <h2>
                {r.memberName}
                <small>회원</small>
              </h2>
              <p className="muted">{r.typeName}</p>
              {r.status === "completed" && (
                <div className="trainer-feedback">
                  <strong>PT 피드백</strong>
                  <p>{r.note || "아직 피드백을 작성하지 않았어요."}</p>
                </div>
              )}
              {r.approval === "rejected" && (
                <p className="help trainer-state-help">
                  거절한 예약입니다. 회원이 새로 예약할 수 있어요.
                </p>
              )}
              <button
                className={r.status === "booked" ? "primary full" : "full"}
                onClick={() => setSelected(r)}
              >
                {r.status === "booked" && r.approval === "pending"
                  ? "예약 검토"
                  : r.status === "booked"
                    ? "수업 처리"
                    : r.status === "completed"
                      ? "PT 피드백 작성 · 수정"
                      : "수업 상세"}
              </button>
            </article>
          ))}
        </div>
        <footer>힘찬짐 · 회원과 함께 쌓는 건강한 변화</footer>
      </main>
      {selected && (
        <LessonDialog
          reservation={selected}
          close={() => setSelected(null)}
          onDone={refresh}
        />
      )}
    </div>
  );
}
function LessonDialog({
  reservation: r,
  close,
  onDone,
}: {
  reservation: Reservation;
  close: () => void;
  onDone: (message: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    pending = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [note, setNote] = useState(r.note);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);
  async function change(
    body: Record<string, string>,
    message: string,
    confirmation?: string,
  ) {
    if (pending.current) return;
    if (confirmation && !window.confirm(confirmation)) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await api(`trainer/reservations/${r.id}`, "PATCH", {
        ...body,
        ...(body.approval ? { expectedStartsAt: r.startsAt } : {}),
      });
      onDone(message);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "저장하지 못했어요. 다시 시도해 주세요.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const awaiting = r.status === "booked" && r.approval === "pending";
  const ready =
    r.status === "booked" && (r.approval ?? "approved") === "approved";
  return (
    <dialog
      ref={ref}
      aria-label="담당 수업 관리"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
    >
      <div className="modal-head">
        <h2>담당 수업 관리</h2>
        <button
          className="icon-button"
          aria-label="닫기"
          disabled={busy}
          onClick={close}
        >
          ×
        </button>
      </div>
      <div className="detail-summary">
        <strong>
          {r.memberName} · {r.typeName}
        </strong>
        <p>{time(r.startsAt)}</p>
        <p>
          <Status reservation={r} />
        </p>
      </div>
      {error && <Notice>{error}</Notice>}
      {awaiting && (
        <>
          <p className="help">
            회원이 요청한 일정을 확인해 주세요. 승인 후 수업을 완료하거나 노쇼로
            처리할 수 있어요.
          </p>
          <div className="trainer-dialog-actions" aria-busy={busy}>
            <button
              disabled={busy}
              onClick={() =>
                change(
                  { approval: "rejected" },
                  "예약을 거절했어요. 회원이 다시 예약할 수 있어요.",
                  `${r.memberName}님의 ${time(r.startsAt)} 예약을 거절할까요? 확보한 이용 횟수는 반환돼요.`,
                )
              }
            >
              예약 거절
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                change(
                  { approval: "approved" },
                  "예약을 승인했어요.",
                  `${r.memberName}님의 ${time(r.startsAt)} 예약을 승인할까요?`,
                )
              }
            >
              예약 승인
            </button>
          </div>
        </>
      )}
      {ready && (
        <>
          <p className="help">
            수업이 끝나면 완료 처리해 주세요. 완료·노쇼는 이용권 1회가 차감되며
            되돌릴 수 없어요.
          </p>
          <div className="trainer-dialog-actions" aria-busy={busy}>
            <button
              disabled={busy}
              onClick={() =>
                change(
                  { status: "noshow" },
                  "노쇼로 처리했어요.",
                  `${r.memberName}님을 노쇼 처리할까요? 이용권 1회가 차감되며 되돌릴 수 없어요.`,
                )
              }
            >
              노쇼 처리
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                change(
                  { status: "completed" },
                  "수업을 완료했어요. 완료 · PT 피드백에서 피드백을 남겨 주세요.",
                  `${r.memberName}님의 수업을 완료할까요? 이용권 1회가 차감되며 되돌릴 수 없어요.`,
                )
              }
            >
              수업 완료
            </button>
          </div>
        </>
      )}
      {r.status === "completed" && (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            void change({ note }, "PT 피드백을 저장했어요.");
          }}
          aria-busy={busy}
        >
          <Field label="PT 피드백">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={3000}
              rows={6}
              disabled={busy}
              placeholder="오늘 배운 자세와 다음 운동에서 신경 쓸 점을 적어 주세요."
            />
          </Field>
          <p className="help">
            저장한 피드백은 회원에게 보여요. {note.length.toLocaleString()} /
            3,000자
          </p>
          <button className="primary" disabled={busy}>
            {busy ? "저장 중…" : "PT 피드백 저장"}
          </button>
        </form>
      )}
      {!awaiting && !ready && r.status !== "completed" && (
        <>
          <p className="help">처리된 수업의 상태는 변경할 수 없어요.</p>
          <button className="full trainer-close" onClick={close}>
            확인
          </button>
        </>
      )}
    </dialog>
  );
}
