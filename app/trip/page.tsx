import TripStoryHome from "@/components/trip-story-home";
import { nanjingPlanningResult } from "@/lib/trip/nanjing-fixture";

export default function TripPage() {
  return <TripStoryHome fallback={nanjingPlanningResult} />;
}
