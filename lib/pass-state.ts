import type { Pass } from './types';

/** isUsable means that another reservation can be made, not that all sessions are used. */
export function getPassAvailabilityLabel(pass: Pick<Pass, 'expiresOn'|'purchasedOn'|'remainingSessions'|'availableSessions'>, kstDate: string): string {
  if (pass.expiresOn.slice(0, 10) < kstDate) return '기간 만료';
  if (pass.remainingSessions <= 0) return '모두 사용';
  if (pass.purchasedOn.slice(0, 10) > kstDate) return '사용 시작 전';
  if (pass.availableSessions <= 0) return '예약 횟수 확보 완료';
  return `추가 예약 가능 ${pass.availableSessions}회`;
}
