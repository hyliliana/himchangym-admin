"use client";
import { useState } from "react";
import type { HistoryEntry } from "../../lib/scheduling-types";
import type { Reservation } from "../../lib/types";
import {
  Api,
  Load,
  Modal,
  Notice,
  showTime,
  useResource,
} from "./scheduling-shared";

const events: Record<string, string> = {
  requested: "시간 변경 신청",
  approved_change: "시간 변경 승인",
  rejected_change: "시간 변경 거절",
  withdrawn: "시간 변경 신청 철회",
  booked: "예약 등록",
  approval: "예약 승인 상태 변경",
  status: "수업 상태 변경",
  feedback: "PT 피드백 변경",
};
const roles: Record<HistoryEntry["actorRole"], string> = {
  member: "회원",
  trainer: "트레이너",
  admin: "마스터 관리자",
  employee: "부운영자",
};
const status: Record<string, string> = {
  booked: "예약됨",
  completed: "수업 완료",
  cancelled: "취소",
  noshow: "노쇼",
  pending: "승인 대기",
  approved: "승인",
  rejected: "거절",
};
function Values({ value }: { value: Record<string, unknown> | null }) {
  if (!value || !Object.keys(value).length)
    return <p className="help">기록 없음</p>;
  return (
    <dl className="history-values">
      {Object.entries(value)
        .filter(([key]) =>
          ["startsAt", "note", "status", "approval"].includes(key),
        )
        .map(([key, content]) => (
          <div key={key}>
            <dt>
              {
                {
                  startsAt: "수업 시간",
                  note: "PT 피드백",
                  status: "수업 상태",
                  approval: "예약 승인",
                }[key]
              }
            </dt>
            <dd>
              {key === "startsAt" && typeof content === "string"
                ? showTime(content)
                : key === "note"
                  ? String(content ?? "") || "피드백 없음"
                  : (status[String(content)] ?? String(content ?? "—"))}
            </dd>
          </div>
        ))}
    </dl>
  );
}
export function ReservationHistory({
  api,
  prefix,
  reservationId,
}: {
  api: Api;
  prefix: "admin" | "trainer";
  reservationId: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="full history-open"
        onClick={() => setOpen(true)}
      >
        시간 · PT 피드백 변경 이력
      </button>
      {open && (
        <HistoryDialog
          api={api}
          prefix={prefix}
          reservationId={reservationId}
          close={() => setOpen(false)}
        />
      )}
    </>
  );
}
function HistoryDialog({
  api,
  prefix,
  reservationId,
  close,
}: {
  api: Api;
  prefix: "admin" | "trainer";
  reservationId: number;
  close: () => void;
}) {
  const [revision, setRevision] = useState(0);
  const result = useResource<{ history: HistoryEntry[] }>(
    api,
    `${prefix}/reservations/${reservationId}/history`,
    revision,
  );
  return (
    <Modal title="수업 변경 이력" close={close}>
      <Load loading={result.loading} error={result.error} />
      {result.error && (
        <button onClick={() => setRevision((value) => value + 1)}>
          다시 불러오기
        </button>
      )}
      {result.data && !result.data.history.length && (
        <div className="empty">아직 기록된 변경이 없어요.</div>
      )}
      <ol className="reservation-history">
        {result.data?.history.map((entry) => (
          <li key={entry.id}>
            <div className="history-entry-head">
              <strong>{events[entry.event] ?? "수업 정보 변경"}</strong>
              <time dateTime={entry.changedAt}>
                {showTime(entry.changedAt)}
              </time>
            </div>
            <p className="help">
              {entry.actorName} · {roles[entry.actorRole] ?? "운영자"}
            </p>
            <div className="history-comparison">
              <section>
                <h3>변경 전</h3>
                <Values value={entry.before} />
              </section>
              <section>
                <h3>변경 후</h3>
                <Values value={entry.after} />
              </section>
            </div>
          </li>
        ))}
      </ol>
      <button className="full" onClick={close}>
        이력 닫기
      </button>
    </Modal>
  );
}
export function PendingTimeChange({
  api,
  prefix,
  reservation,
  onDone,
  onBusyChange,
}: {
  api: Api;
  prefix: "admin" | "trainer";
  reservation: Reservation;
  onDone: (message: string) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const change = reservation.pendingChange;
  if (!change) return null;
  const canDecide = prefix === "trainer" || reservation.canDeskDecide;
  async function decide(decision: "approve" | "reject") {
    if (
      busy ||
      !change ||
      !window.confirm(
        decision === "approve"
          ? `${showTime(change.startsAt)}로 시간 변경을 승인할까요? 승인할 때 최신 가용 시간과 정원을 다시 확인해요.`
          : "시간 변경을 거절하고 기존 수업 시간을 유지할까요?",
      )
    )
      return;
    setBusy(true);
    onBusyChange?.(true);
    setError("");
    try {
      await api(
        `${prefix}/reservations/${reservation.id}/changes/${change.id}/decision`,
        "POST",
        { decision },
      );
      onDone(
        decision === "approve"
          ? "시간 변경을 승인했어요."
          : "시간 변경을 거절했어요. 기존 일정은 유지돼요.",
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "처리하지 못했어요.");
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  return (
    <section className="pending-time-change" aria-busy={busy}>
      <div className="section-head">
        <h3>시간 변경 신청</h3>
        <span className="badge pending">승인 대기</span>
      </div>
      <dl className="change-times">
        <div>
          <dt>기존 수업 · 유지 중</dt>
          <dd>{showTime(reservation.startsAt)}</dd>
        </div>
        <div>
          <dt>회원이 신청한 시간</dt>
          <dd>{showTime(change.startsAt)}</dd>
        </div>
      </dl>
      <p className="help">
        신청 {showTime(change.requestedAt)} · 승인 전에는 기존 수업이 그대로
        유지돼요.
      </p>
      {error && <Notice>{error}</Notice>}
      {canDecide ? (
        <div className="trainer-dialog-actions">
          <button
            type="button"
            disabled={busy}
            onClick={() => decide("reject")}
          >
            변경 거절
          </button>
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() => decide("approve")}
          >
            시간 변경 승인
          </button>
        </div>
      ) : (
        <p className="help">
          담당 트레이너가 검토할 신청이에요. 트레이너 계정이 연결된 수업은
          데스크에서 대신 처리할 수 없어요.
        </p>
      )}
    </section>
  );
}
