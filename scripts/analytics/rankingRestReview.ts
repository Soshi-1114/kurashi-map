import { RANKING_REST_EVENTS, RANKING_REST_PATH, RANKING_REST_VARIANTS, RANKING_REST_VERSION } from "../../lib/rankingRest";
import { records, ratio, type Snapshot } from "./model";

const number = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;

/** ページ・端末の期間人数はAPI返却値を保ち、版やvariant間で合算しない。 */
export function rankingRestReview(s: Snapshot, period: string) {
  const audience = records(s.captures[`${period}.ga.pages`]);
  const events = records(s.captures[`${period}.ga.rankingRest`]);
  if (audience === null) return null;
  return audience.filter(r => r.pagePath === RANKING_REST_PATH).flatMap(row => RANKING_REST_VARIANTS.map(variant => {
    const cohort = events?.filter(r => r.pagePath === RANKING_REST_PATH && r.deviceCategory === row.deviceCategory && r["customEvent:measurement_version"] === RANKING_REST_VERSION && r["customEvent:cta_variant"] === variant) ?? null;
    const users = number(row.totalUsers);
    const stages = RANKING_REST_EVENTS.map(event => ({
      event,
      count: cohort === null ? null : number(cohort.find(r => r.eventName === event)?.eventCount ?? 0),
      users: cohort === null ? null : number(cohort.find(r => r.eventName === event)?.totalUsers ?? 0),
    }));
    return { path: RANKING_REST_PATH, device: row.deviceCategory, variant, pageUsers: users, stages, restRate: ratio(stages[2].users, users) };
  }));
}
