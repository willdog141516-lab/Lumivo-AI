import TripStoryHome from "@/components/trip-story-home";
import { nanjingPlanningResult } from "@/lib/trip/nanjing-fixture";

export default function Home() {
  return <TripStoryHome fallback={nanjingPlanningResult} />;
}
