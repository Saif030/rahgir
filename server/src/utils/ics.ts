import { createEvents, type EventAttributes } from "ics";

export interface IcsEventInput {
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
}

export function buildIcs(itineraryName: string, events: IcsEventInput[]): Promise<string> {
  const icsEvents: EventAttributes[] = events.map((e) => ({
    title: e.title,
    description: e.description ?? "",
    location: e.location ?? "",
    start: toArray(e.start),
    end: toArray(e.end),
    productId: "rahgir/itinerary",
    calName: itineraryName,
  }));
  return new Promise((resolve, reject) => {
    createEvents(icsEvents, (err, value) => {
      if (err) reject(err);
      else resolve(value);
    });
  });
}

function toArray(d: Date): [number, number, number, number, number] {
  return [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()];
}
