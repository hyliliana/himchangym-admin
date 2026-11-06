export type Facility = { startHour: number; endHour: number; capacity: number };
export type Contract = {
  id: number;
  startDate: string;
  endDate: string;
  minSlots: number;
  maxSlots: number;
  allowedWeekdays: number[];
  startHour: number;
  endHour: number;
};
export type Progress = { approved: number; pending: number; total: number };
export type Slot = {
  id: number;
  trainerId: number;
  trainerName: string;
  startsAt: string;
  status: "approved" | "pending" | "rejected" | "withdrawn";
  withinScope: boolean;
  reason: string;
  hasReservation: boolean;
};
export type Schedule = {
  contract: Contract | null;
  progress: Progress;
  slots: Slot[];
  contracts?: (Contract & { progress: Progress })[];
};
export type Candidates = {
  candidates: { startsAt: string; withinScope: boolean }[];
  facility: Facility;
  contract: Contract | null;
  progress: Progress;
};
export type HistoryEntry = {
  id: number;
  event: string;
  actorName: string;
  actorRole: "member" | "trainer" | "admin" | "employee";
  changedAt: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};
