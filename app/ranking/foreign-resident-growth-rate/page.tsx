import ForeignRankingPage, { foreignRankingMetadata } from '@/components/foreign-resident-issues/ForeignRankingPage';
import { FOREIGN_RANKINGS } from '@/lib/foreignRankings';

const def = FOREIGN_RANKINGS[1];
export function generateMetadata() { return foreignRankingMetadata(def); }
export default function Page() { return <ForeignRankingPage def={def} />; }
