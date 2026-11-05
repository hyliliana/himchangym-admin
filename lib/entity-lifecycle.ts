export type EntityFilter = 'active' | 'deleted' | 'all';
export type LifecycleKind = 'members' | 'trainers' | 'pass-types';

export function filterEntities<T extends {deletedAt:string|null}>(items:T[], filter:EntityFilter):T[] {
  return items.filter(item=>filter==='all'||(filter==='deleted'?!!item.deletedAt:!item.deletedAt));
}
