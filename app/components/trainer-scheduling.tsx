"use client";
import { useState } from "react";
import type { Candidates, Schedule, Slot } from "../../lib/scheduling-types";
import {
  Api,
  CandidateCalendar,
  Form,
  Load,
  Modal,
  Notice,
  kstDate,
  showTime,
  useResource,
  weekdays,
} from "./scheduling-shared";

const statusLabels: Record<Slot["status"], string> = {
  approved: "공개 중",
  pending: "범위 밖 · 승인 대기",
  rejected: "승인 거절",
  withdrawn: "철회됨",
};
export default function TrainerScheduling({
  api,
  prefix = "trainer",
  revision = 0,
}: {
  api: Api;
  prefix?: string;
  revision?: number;
}) {
  const [version, setVersion] = useState(0),
    [editing, setEditing] = useState<Slot | "new" | null>(null),
    [message, setMessage] = useState(""),
    [actionError, setActionError] = useState(""),
    [busyId, setBusyId] = useState<number | null>(null);
  const result = useResource<Schedule>(
    api,
    `${prefix}/schedule`,
    version + revision,
  );
  const schedule = result.data;
  const master = prefix.startsWith("admin/");
  function refresh(text: string) {
    setEditing(null);
    setMessage(text);
    setVersion((value) => value + 1);
  }
  async function withdraw(slot: Slot) {
    if (
      busyId !== null ||
      !window.confirm(
        `${showTime(slot.startsAt)} 가용 시간을 철회할까요? 회원의 예약 후보에서 제외돼요.`,
      )
    )
      return;
    setBusyId(slot.id);
    setActionError("");
    try {
      await api(
        master ? `admin/slots/${slot.id}` : `trainer/slots/${slot.id}`,
        "DELETE",
      );
      refresh("가용 시간을 철회했어요.");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "철회하지 못했어요.",
      );
    } finally {
      setBusyId(null);
    }
  }
  return (
    <section className="schedule-workspace">
      <div className="section-head">
        <div>
          {master ? <h2>가용 시간 · 계약</h2> : <h1>가용 시간 · 계약</h1>}
          <p>계약에 맞춰 수업 가능한 시간을 공개해 주세요.</p>
        </div>
        <button
          disabled={result.loading}
          onClick={() => setVersion((value) => value + 1)}
        >
          새로고침
        </button>
      </div>
      {message && <Notice success>{message}</Notice>}
      <Load loading={result.loading} error={result.error} />
      {actionError && <Notice>{actionError}</Notice>}
      {schedule && (
        <>
          {schedule.contract ? (
            <section className="card contract-summary">
              <div className="section-head">
                <div>
                  <h3>최근 계약 목표와 진행</h3>
                  <p>
                    {schedule.contract.startDate.slice(0, 10)} ~{" "}
                    {schedule.contract.endDate.slice(0, 10)}
                  </p>
                </div>
                <span className="badge completed">
                  최소 목표 {schedule.contract.minSlots}개
                </span>
              </div>
              <div className="contract-progress">
                <strong>
                  {schedule.progress.approved}
                  <small>개 승인</small>
                </strong>
                <span>
                  등록 {schedule.progress.total}개 · 승인 대기{" "}
                  {schedule.progress.pending}개 · 최대{" "}
                  {schedule.contract.maxSlots}개
                </span>
              </div>
              <progress
                aria-label="최소 계약 목표 대비 승인 시간"
                max={Math.max(1, schedule.contract.minSlots)}
                value={Math.min(
                  schedule.contract.minSlots,
                  schedule.progress.approved,
                )}
              />
              <p className="help">
                허용 요일{" "}
                {schedule.contract.allowedWeekdays
                  .map((day) => weekdays[day])
                  .join(" · ")}{" "}
                · {schedule.contract.startHour}:00 ~ {schedule.contract.endHour}
                :00
              </p>
              <p className="help">
                허용 범위 안은 바로 공개되고, 범위 밖은 마스터 관리자 승인 후
                공개돼요. 승인 대기도 최대 등록 수에 포함돼요.
              </p>
            </section>
          ) : (
            <section className="card empty">
              아직 등록된 계약이 없어요.
              <br />
              {master
                ? "먼저 이 트레이너의 계약을 저장해 주세요."
                : "마스터 관리자에게 계약 등록을 요청해 주세요."}
            </section>
          )}
          {schedule.contracts && schedule.contracts.length > 0 && (
            <details className="card contract-history">
              <summary>
                전체 계약 · 실적 보기 ({schedule.contracts.length}개)
              </summary>
              {schedule.contracts.map((contract) => (
                <article key={contract.id}>
                  <strong>
                    {contract.startDate.slice(0, 10)} ~{" "}
                    {contract.endDate.slice(0, 10)}
                  </strong>
                  <p className="help">
                    승인 {contract.progress.approved}개 · 대기{" "}
                    {contract.progress.pending}개 · 최소 목표{" "}
                    {contract.minSlots}개 / 최대 {contract.maxSlots}개
                  </p>
                  <p className="help">
                    {contract.allowedWeekdays
                      .map((day) => weekdays[day])
                      .join(" · ")}{" "}
                    · {contract.startHour}:00 ~ {contract.endHour}:00
                  </p>
                </article>
              ))}
            </details>
          )}
          <section className="card">
            <div className="section-head">
              <div>
                <h3>등록한 가용 시간</h3>
                <p>
                  예약이 있거나 지난 공개 시간은 수정·철회할 수 없어요. 지난
                  승인 대기는 철회할 수 있어요.
                </p>
              </div>
              <button
                className="primary"
                disabled={!schedule.contract && !schedule.contracts?.length}
                onClick={() => setEditing("new")}
              >
                가용 시간 등록
              </button>
            </div>
            {schedule.slots.length ? (
              <div className="schedule-slot-list">
                {schedule.slots.map((slot) => (
                  <article className="schedule-slot" key={slot.id}>
                    <div>
                      <strong>{showTime(slot.startsAt)}</strong>
                      <span
                        className={`badge ${slot.status === "approved" ? "completed" : slot.status === "pending" ? "pending" : "cancelled"}`}
                      >
                        {slot.status === "approved" &&
                        Date.parse(slot.startsAt) <= Date.now()
                          ? "공개 실적"
                          : slot.status === "pending" &&
                              Date.parse(slot.startsAt) <= Date.now()
                            ? "기한 지남 · 승인 대기"
                            : statusLabels[slot.status]}
                      </span>
                      {slot.reason && <p className="help">{slot.reason}</p>}
                      {Date.parse(slot.startsAt) <= Date.now() && (
                        <p className="help">
                          과거 기록이에요. 승인 대기 중이면 철회해 등록 수를
                          정리할 수 있어요.
                        </p>
                      )}
                      {slot.hasReservation && (
                        <p className="help">
                          예약 있음 · 기존 수업을 유지해요.
                        </p>
                      )}
                    </div>
                    {slot.status !== "withdrawn" && (
                      <div className="row-actions">
                        <button
                          disabled={
                            slot.hasReservation ||
                            Date.parse(slot.startsAt) <= Date.now() ||
                            busyId !== null
                          }
                          onClick={() => setEditing(slot)}
                        >
                          시간 수정
                        </button>
                        <button
                          disabled={
                            slot.hasReservation ||
                            (Date.parse(slot.startsAt) <= Date.now() &&
                              slot.status !== "pending") ||
                            busyId !== null
                          }
                          onClick={() => withdraw(slot)}
                        >
                          {busyId === slot.id ? "철회 중…" : "철회"}
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty">
                등록한 가용 시간이 없어요. 가능한 날짜와 시간을 선택해 주세요.
              </div>
            )}
          </section>
        </>
      )}
      {editing && (
        <SlotEditor
          api={api}
          prefix={prefix}
          slot={editing}
          close={() => setEditing(null)}
          onDone={refresh}
        />
      )}
    </section>
  );
}
function SlotEditor({
  api,
  prefix,
  slot,
  close,
  onDone,
}: {
  api: Api;
  prefix: string;
  slot: Slot | "new";
  close: () => void;
  onDone: (message: string) => void;
}) {
  const [month, setMonth] = useState(
      (slot === "new" ? kstDate() : kstDate(new Date(slot.startsAt))).slice(
        0,
        7,
      ),
    ),
    [value, setValue] = useState(""),
    [busy, setBusy] = useState(false);
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0))
    .toISOString()
    .slice(0, 10);
  const query = new URLSearchParams({ from: `${month}-01`, to: lastDay });
  if (slot !== "new") query.set("excludeSlotId", String(slot.id));
  const [retry, setRetry] = useState(0);
  const result = useResource<Candidates>(
    api,
    `${prefix}/slot-candidates?${query}`,
    retry,
  );
  const selected = result.data?.candidates.find(
    (candidate) => candidate.startsAt === value,
  );
  return (
    <Modal
      title={slot === "new" ? "가용 시간 등록" : "가용 시간 수정"}
      close={close}
      busy={busy}
    >
      <Form
        submit={
          selected?.withinScope === false
            ? "범위 밖 승인 신청"
            : slot === "new"
              ? "가용 시간 공개"
              : "시간 수정"
        }
        submitDisabled={result.loading || !selected}
        onBusyChange={setBusy}
        onSubmit={async () => {
          if (result.loading || !selected)
            throw new Error("선택 가능한 날짜와 시간을 먼저 골라 주세요.");
          const path =
            slot === "new"
              ? `${prefix}/slots`
              : prefix.startsWith("admin/")
                ? `admin/slots/${slot.id}`
                : `trainer/slots/${slot.id}`;
          const saved = await api<{ slot: Slot }>(
            path,
            slot === "new" ? "POST" : "PATCH",
            {
              startsAt: value,
            },
          );
          onDone(
            saved.slot.status === "pending"
              ? "범위 밖 시간 승인을 신청했어요. 승인 후 회원에게 공개돼요."
              : "가용 시간을 저장했어요.",
          );
        }}
      >
        <Load loading={result.loading} error={result.error} />
        {result.error && (
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            후보 다시 불러오기
          </button>
        )}
        {slot !== "new" && (
          <p className="help">기존 시간: {showTime(slot.startsAt)}</p>
        )}
        <CandidateCalendar
          candidates={result.data?.candidates ?? []}
          value={value}
          onChange={setValue}
          month={month}
          onMonthChange={setMonth}
          busy={busy || result.loading}
        />
        {selected && (
          <div className="detail-summary">
            <strong>{showTime(selected.startsAt)}</strong>
            <p>
              {selected.withinScope
                ? "허용 범위 안 · 저장하면 바로 공개돼요."
                : "허용 범위 밖 · 마스터 관리자 승인 후 공개돼요."}
            </p>
          </div>
        )}
      </Form>
    </Modal>
  );
}
