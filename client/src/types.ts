export type Role = "ATTENDEE" | "ORGANISER" | "ADMIN";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Venue {
  id: string;
  name: string;
  building: string;
  floor?: string | null;
  lat: number;
  lng: number;
  capacity: number;
  amenities: string[];
  eateryNearby: boolean;
  upcomingEvents?: ApiEvent[];
}

export interface ApiEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  venueId: string;
  venue?: Venue;
  startsAt: string;
  endsAt: string;
  capacity: number;
  registeredCount: number;
  difficulty: string;
  speakerName?: string | null;
  speakerBio?: string | null;
  planOut: { setupMin?: number; bufferMin?: number; teardownMin?: number };
  status: "SCHEDULED" | "CANCELLED" | "MOVED";
  availability: "available" | "almost-full" | "full";
}

export interface ItineraryItem {
  id: string;
  eventId: string;
  order: number;
  event: ApiEvent & { venue?: Venue };
}

export interface Itinerary {
  id: string;
  name: string;
  items: ItineraryItem[];
  conflicts: { a: string; b: string }[];
  totalMin: number;
  gaps: { from: string; to: string; gapMin: number }[];
}

export interface OptimizedLeg {
  fromEventId: string | null;
  toEventId: string;
  departAt: string;
  arriveAt: string;
  travelMin: number;
  distanceM: number;
  source: string;
  feasible: boolean;
}

export interface OptimizedRoute {
  sequence: string[];
  legs: OptimizedLeg[];
  totalTravelMin: number;
  warnings: string[];
  eateryStops?: { afterEventId: string; venueId: string; venueName: string; gapMin: number }[];
}

export const CATEGORY_COLORS: Record<string, string> = {
  Tech: "#2f6bff",
  Design: "#a855f7",
  Business: "#f59e0b",
  Networking: "#10b981",
  Wellness: "#ef4444",
};

export function colorFor(category: string): string {
  return CATEGORY_COLORS[category] ?? "#64748b";
}
