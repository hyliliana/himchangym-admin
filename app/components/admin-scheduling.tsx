"use client";
import { useState } from "react";
import type { Trainer } from "../../lib/types";
import type {
  Contract,
  Facility,
  Progress,
  Slot,
} from "../../lib/scheduling-types";
import TrainerScheduling from "./trainer-scheduling";
import {
  Api,
  Field,
  Form,
  Load,
  Modal,
  Notice,
  kstDate,
  showTime,
  useResource,
  weekdays,
} from "./scheduling-shared";

export default function AdminScheduling({ api }: { api: Api }) {
  const [revision, setRevision] = useState(0),
    [trainerId, setTrainerId] = useState<number | null>(null),
    [editingFacility, setEditingFacility] = useState(false),
    [contractMode, setContractMode] = useState<"edit" | "new" | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const facility = useResource<{ facility: Facility }>(
    api,
    "admin/facility",
    revision,
  );
  const catalog = useResource<{ trainers: Trainer[] }>(
    api,
    "admin/catalog",
    revision,
  );
  const selectedId =
    trainerId ??
    catalog.data?.trainers.find((trainer) => !trainer.deletedAt)?.id ??
    null;
  const selectedTrainer = catalog.data?.trainers.find(
    (trainer) => trainer.id === selectedId,
  );
  const contract = useResource<{
    contract: Contract | null;
    progress: Progress;
  }>(
    api,
    selectedId ? `admin/trainers/${selectedId}/contract` : null,
    revision,
  );
  function refresh(text: string) {
    setEditingFacility(false);
    setContractMode(null);
    setMessage(text);
    setRevision((value) => value + 1);
  }
  return (
    <>
      <div className="schedule-refresh">
        <button
          disabled={facility.loading || catalog.loading}
          onClick={() => setRevision((value) => value + 1)}
        >
          새로고침
        </button>
      </div>
      <p className="help schedule-intro">
        시설 정원과 트레이너 계약을 설정하고 허용 범위 밖의 시간 신청을 검토해
        주세요.
      </p>
      {message && <Notice success>{message}</Notice>}
      <Load loading={facility.loading} error={facility.error} />
      {facility.data && (
        <section className="card">
          <div className="section-head">
            <div>
              <h2>시설 운영 기준</h2>
              <p>
                운영 시간 {facility.data.facility.startHour}:00 ~{" "}
                {facility.data.facility.endHour}:00 · 동시 PT 정원{" "}
                {facility.data.facility.capacity}명
              </p>
            </div>
            <button onClick={() => setEditingFacility(true)}>
              운영 기준 수정
            </button>
          </div>
          <p className="help">
            트레이너가 공개하는 시간은 시설 운영 시간과 동시 정원을 만족해야
            해요. 변경이 기존 가용 시간·수업과 충돌하면 저장할 수 없어요.
          </p>
        </section>
      )}
      <SlotApprovals api={api} revision={revision} onChanged={refresh} />
      <section className="card">
        <div className="section-head">
          <div>
            <h2>트레이너 계약</h2>
            <p>최소 목표·최대 등록 수와 허용 요일·시간을 설정해 주세요.</p>
          </div>
        </div>
        <Load loading={catalog.loading} error={catalog.error} />
        <Field label="트레이너">
          <select
            value={selectedId ?? ""}
            onChange={(event) => setTrainerId(Number(event.target.value))}
            disabled={catalog.loading || !catalog.data?.trainers.length}
          >
            {!catalog.data?.trainers.length && (
              <option value="">등록된 트레이너 없음</option>
            )}
            {catalog.data?.trainers
              .filter((trainer) => !trainer.deletedAt)
              .map((trainer) => (
                <option key={trainer.id} value={trainer.id}>
                  {trainer.name}
                </option>
              ))}
          </select>
        </Field>
        <Load loading={contract.loading} error={contract.error} />
        {selectedTrainer && contract.data && (
          <div className="contract-management">
            <div>
              <strong>{selectedTrainer.name} 트레이너</strong>
              <p className="help">
                {contract.data.contract
                  ? `${contract.data.contract.startDate.slice(0, 10)} ~ ${contract.data.contract.endDate.slice(0, 10)} · 목표 ${contract.data.contract.minSlots}개 / 최대 ${contract.data.contract.maxSlots}개`
                  : "아직 등록된 계약이 없어요."}
              </p>
            </div>
            <div className="row-actions">
              {contract.data.contract && (
                <button onClick={() => setContractMode("edit")}>
                  최근 계약 수정
                </button>
              )}
              <button
                className="primary"
                onClick={() => setContractMode("new")}
              >
                새 계약 등록
              </button>
            </div>
          </div>
        )}
        <p className="help">
          계약 갱신은 새 계약으로 등록해 주세요. 지난 계약과 가용 시간·수업
          실적을 보존해요.
        </p>
      </section>
      {selectedId && (
        <TrainerScheduling
          key={selectedId}
          api={api}
          prefix={`admin/trainers/${selectedId}`}
          revision={revision}
        />
      )}
      {editingFacility && facility.data && (
        <Modal
          title="시설 운영 기준 수정"
          close={() => setEditingFacility(false)}
          busy={busy}
        >
          <Form
            onBusyChange={setBusy}
            onSubmit={async (form) => {
              const startHour = Number(form.get("startHour")),
                endHour = Number(form.get("endHour"));
              if (startHour >= endHour)
                throw new Error(
                  "종료 시각은 시작 시각보다 늦게 설정해 주세요.",
                );
              await api("admin/facility", "PATCH", {
                startHour,
                endHour,
                capacity: Number(form.get("capacity")),
              });
              refresh("시설 운영 기준을 저장했어요.");
            }}
          >
            <div className="form-grid">
              <HourField
                label="운영 시작"
                name="startHour"
                value={facility.data.facility.startHour}
              />
              <HourField
                label="운영 종료"
                name="endHour"
                value={facility.data.facility.endHour}
                end
              />
            </div>
            <Field label="동시 PT 정원 (명)">
              <input
                name="capacity"
                type="number"
                min={1}
                max={100}
                required
                defaultValue={facility.data.facility.capacity}
              />
            </Field>
            <p className="help">
              운영 시간은 매일 같은 기준으로 적용돼요. 이미 등록된 시간과
              충돌하는 변경은 차단돼요.
            </p>
          </Form>
        </Modal>
      )}
      {contractMode && selectedId && selectedTrainer && (
        <ContractEditor
          api={api}
          trainerId={selectedId}
          name={selectedTrainer.name}
          contract={
            contractMode === "edit" ? (contract.data?.contract ?? null) : null
          }
          newContract={contractMode === "new"}
          close={() => setContractMode(null)}
          onDone={refresh}
        />
      )}
    </>
  );
}
function HourField({
  label,
  name,
  value,
  end = false,
}: {
  label: string;
  name: string;
  value: number;
  end?: boolean;
}) {
  return (
    <Field label={label}>
      <select name={name} defaultValue={value}>
        {Array.from({ length: 24 }, (_, index) => index + (end ? 1 : 0)).map(
          (hour) => (
            <option key={hour} value={hour}>
              {String(hour).padStart(2, "0")}:00
            </option>
          ),
        )}
      </select>
    </Field>
  );
}
function ContractEditor({
  api,
  trainerId,
  name,
  contract,
  newContract,
  close,
  onDone,
}: {
  api: Api;
  trainerId: number;
  name: string;
  contract: Contract | null;
  newContract: boolean;
  close: () => void;
  onDone: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={`${name} · ${newContract ? "새 계약 등록" : "계약 수정"}`}
      close={close}
      busy={busy}
    >
      <Form
        onBusyChange={setBusy}
        onSubmit={async (form) => {
          const startDate = String(form.get("startDate")),
            endDate = String(form.get("endDate")),
            minSlots = Number(form.get("minSlots")),
            maxSlots = Number(form.get("maxSlots")),
            startHour = Number(form.get("startHour")),
            endHour = Number(form.get("endHour")),
            allowedWeekdays = form.getAll("allowedWeekdays").map(Number);
          if (startDate > endDate)
            throw new Error("계약 종료일을 시작일 이후로 설정해 주세요.");
          if (minSlots > maxSlots)
            throw new Error("최대 등록 수는 최소 목표 이상이어야 해요.");
          if (startHour >= endHour || !allowedWeekdays.length)
            throw new Error("허용 요일과 시간 범위를 확인해 주세요.");
          await api(
            `admin/trainers/${trainerId}/${newContract ? "contracts" : "contract"}`,
            newContract ? "POST" : "PATCH",
            {
              startDate,
              endDate,
              minSlots,
              maxSlots,
              allowedWeekdays,
              startHour,
              endHour,
            },
          );
          onDone(
            newContract
              ? "새 계약을 등록했어요. 이전 계약과 실적은 유지돼요."
              : "트레이너 계약을 저장했어요.",
          );
        }}
      >
        <div className="form-grid">
          <Field label="계약 시작일">
            <input
              type="date"
              name="startDate"
              required
              defaultValue={contract?.startDate.slice(0, 10) ?? kstDate()}
            />
          </Field>
          <Field label="계약 종료일">
            <input
              type="date"
              name="endDate"
              required
              defaultValue={contract?.endDate.slice(0, 10)}
            />
          </Field>
        </div>
        <div className="form-grid">
          <Field label="최소 등록 목표 (개)">
            <input
              name="minSlots"
              type="number"
              min={0}
              max={10000}
              required
              defaultValue={contract?.minSlots ?? 20}
            />
          </Field>
          <Field label="최대 등록 수 (개)">
            <input
              name="maxSlots"
              type="number"
              min={1}
              max={10000}
              required
              defaultValue={contract?.maxSlots ?? 100}
            />
          </Field>
        </div>
        <fieldset className="weekday-field">
          <legend>자동 공개할 허용 요일</legend>
          <div className="weekday-options">
            {weekdays.map((day, index) => (
              <label key={day}>
                <input
                  name="allowedWeekdays"
                  type="checkbox"
                  value={index}
                  defaultChecked={
                    contract?.allowedWeekdays.includes(index) ??
                    (index > 0 && index < 6)
                  }
                />
                <span>{day}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="form-grid">
          <HourField
            label="허용 시작 시각"
            name="startHour"
            value={contract?.startHour ?? 9}
          />
          <HourField
            label="허용 종료 시각"
            name="endHour"
            value={contract?.endHour ?? 18}
            end
          />
        </div>
        <p className="help">
          기간 안의 시설 운영 시간 중 허용 요일·시간을 벗어난 신청은 승인 대기가
          돼요. 계약 기간 밖은 새 계약 등록이나 계약 수정이 필요해요.
        </p>
      </Form>
    </Modal>
  );
}
function SlotApprovals({
  api,
  revision,
  onChanged,
}: {
  api: Api;
  revision: number;
  onChanged: (message: string) => void;
}) {
  const result = useResource<{ slots: Slot[] }>(
    api,
    "admin/slots?status=pending",
    revision,
  );
  const [selected, setSelected] = useState<Slot | null>(null),
    [busy, setBusy] = useState(false);
  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h2>범위 밖 시간 승인</h2>
          <p>계약의 허용 요일·시간을 벗어난 등록·변경 신청이에요.</p>
        </div>
        <span className="count">{result.data?.slots.length ?? 0}건</span>
      </div>
      <Load loading={result.loading} error={result.error} />
      {result.data && !result.data.slots.length && (
        <div className="empty">검토할 시간 신청이 없어요.</div>
      )}
      <div className="schedule-slot-list">
        {result.data?.slots.map((slot) => (
          <article className="schedule-slot" key={slot.id}>
            <div>
              <strong>{slot.trainerName}</strong>
              <p>{showTime(slot.startsAt)}</p>
              <span className="badge pending">범위 밖 · 승인 대기</span>
            </div>
            <button onClick={() => setSelected(slot)}>신청 검토</button>
          </article>
        ))}
      </div>
      {selected && (
        <Modal
          title="가용 시간 승인 검토"
          close={() => setSelected(null)}
          busy={busy}
        >
          <div className="detail-summary">
            <strong>{selected.trainerName}</strong>
            <p>{showTime(selected.startsAt)}</p>
          </div>
          <Form
            onBusyChange={setBusy}
            submit="검토 결과 저장"
            onSubmit={async (form) => {
              const status = String(form.get("status"));
              if (
                !window.confirm(
                  status === "approved"
                    ? "이 시간을 승인해 회원에게 공개할까요?"
                    : "이 시간 신청을 거절할까요?",
                )
              )
                return;
              await api(`admin/slots/${selected.id}/decision`, "PATCH", {
                status,
                expectedStartsAt: selected.startsAt,
                reason: String(form.get("reason")).trim(),
              });
              setSelected(null);
              onChanged(
                status === "approved"
                  ? "신청한 시간을 승인하고 공개했어요."
                  : "시간 신청을 거절했어요.",
              );
            }}
          >
            <Field label="검토 결과">
              <select
                name="status"
                defaultValue={
                  Date.parse(selected.startsAt) <= Date.now()
                    ? "rejected"
                    : "approved"
                }
              >
                <option
                  value="approved"
                  disabled={Date.parse(selected.startsAt) <= Date.now()}
                >
                  승인 · 회원에게 공개
                </option>
                <option value="rejected">거절</option>
              </select>
            </Field>
            <Field label="검토 의견 (선택)">
              <textarea
                name="reason"
                rows={3}
                maxLength={1000}
                placeholder="트레이너가 확인할 수 있는 의견을 적어 주세요."
              />
            </Field>
            <p className="help">
              지난 신청은 승인할 수 없으며 거절만 할 수 있어요. 승인할 때 시설
              정원과 계약 조건을 다시 확인해요.
            </p>
          </Form>
        </Modal>
      )}
    </section>
  );
}
