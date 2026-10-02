import { TEAM_SIZE, TRACKS } from "@pandora/core";

// Placeholder copy from the Figma file. The organisers replace the track names, statements and expected
// solutions with the real ones; the structure here is final.

export type Fact = {
  label: string;
  /** Text shown big. */
  value: string;
  /** A small currency mark shown before the value. */
  currency?: string;
  note?: string;
};

export const FACTS: Fact[] = [
  { label: "Date", value: "23rd October 2026" },
  { label: "Team", value: `${TEAM_SIZE.min} to ${TEAM_SIZE.max} members`, note: "are allowed per team" },
  {
    label: "Venue",
    value: "TP Ganeshan Mini Hall 1",
    note: "SRM Institute of Science and Technology, Kattankulathur",
  },
  {
    label: "Eligibility",
    value: "Enrolled Students",
    note: "Ist, IInd, IIIrd years in Engineering B.Tech. School of Computing, SRM IST",
  },
  { label: "Registration", value: "200", currency: "₹", note: "as registration fee per team" },
  {
    label: "Prizes",
    value: "50,000",
    currency: "₹",
    note: "in prize pool + Goodies and Internship Opportunities",
  },
];

const LOREM = "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium";

export type TrackInfo = {
  /** "Track A": the id used everywhere else (registration, database). */
  id: (typeof TRACKS)[number];
  name: string;
  summary: string;
  statement: string;
  expectedSolution: string;
};

const NAMES = ["Medi-medi-medi", "Brampton", "cAT-eATS-eVERYTHING", "Sula"] as const;

export const TRACK_INFO: TrackInfo[] = TRACKS.map((id, index) => ({
  id,
  name: NAMES[index] ?? id,
  summary: LOREM,
  statement: `${LOREM}, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis.`,
  expectedSolution: `${LOREM}, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis.`,
}));

export type Milestone = {
  /** Shown above the title; "TBA" until the organisers confirm the date. */
  date: string;
  title: string;
  text: string;
  /** Outline and node colour, a --pandora-* token. */
  color: "violet" | "sky" | "rose" | "gold";
};

// Placeholder schedule. Dates assume the event on Friday 23rd October 2026 and registration open from Friday 2nd.
// Registration closes on a Sunday, Episode 0 runs Monday to 4 days before the event, then the 64 teams are told.
export const TIMELINE: Milestone[] = [
  { date: "Now", title: "Registrations open", text: "Form a team of 3 or 4 and register with your SRM email.", color: "violet" },
  { date: "Sunday, 11th October", title: "Registrations close", text: "Last day to register and get your payment approved.", color: "sky" },
  { date: "Monday, 12th October", title: "Episode 0 begins", text: "Verified teams start working on their Episode 0 submission.", color: "rose" },
  { date: "Monday, 19th October", title: "Episode 0 submissions close", text: "Submit your repository link before the deadline: four days to the event.", color: "gold" },
  { date: "Soon after", title: "The 64 teams are announced", text: "The 64 teams that make it get their event tickets on their dashboard.", color: "violet" },
  { date: "Friday, 23rd October", title: "Event day", text: "Check in with your ticket and take on Episodes 1, 2 and 3 at TP Ganeshan Mini Hall 1.", color: "sky" },
];

export type AboutSlide = {
  /** "about" is the first slide; the rest are past events. The heading highlights accordingly. */
  kind: "about" | "past";
  title: string;
  text: string;
  photo: string;
  photoAlt: string;
};

const ABOUT_TEXT =
  "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.";

// Placeholder slides: three cards with the same photo until the organisers supply real ones.
export const ABOUT_SLIDES: AboutSlide[] = [
  { kind: "about", title: "About us", text: ABOUT_TEXT, photo: "/landing/group-photo.webp", photoAlt: "Microsoft Student Ambassadors SRM members in a lecture hall" },
  { kind: "past", title: "Past event one", text: ABOUT_TEXT, photo: "/landing/group-photo.webp", photoAlt: "Participants at a past MSA SRM event" },
  { kind: "past", title: "Past event two", text: ABOUT_TEXT, photo: "/landing/group-photo.webp", photoAlt: "Participants at a past MSA SRM event" },
];
