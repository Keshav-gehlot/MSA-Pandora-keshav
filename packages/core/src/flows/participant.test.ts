import { describe, expect, it } from "vitest";
import {
  isEpisodeZeroOpen,
  submissionSchema,
  teamEditSchema,
} from "./participant";

const m = (id: string, n: number) => ({
  id,
  firstName: `M${n}`,
  lastName: "T",
  regNumber: `RA261102601069${n}`,
  srmEmail: `m${n}@srmist.edu.in`,
  personalEmail: `m${n}@gmail.com`,
  phone: `987654321${n}`,
});

const ids = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
];

describe("teamEditSchema", () => {
  it("accepts a full snapshot and normalizes it", () => {
    const r = teamEditSchema.parse({
      teamName: " Null Pointers ",
      track: "Track A",
      members: ids.map((id, i) => ({
        ...m(id, i + 1),
        srmEmail: `M${i + 1}@SRMIST.EDU.IN`,
      })),
    });

    expect(r.teamName).toBe("Null Pointers");

    expect(r.members[0]).toMatchObject({
      id: ids[0],
      srmEmail: "m1@srmist.edu.in",
    });
  });

  it("rejects a member without an id and a bad phone", () => {
    const r = teamEditSchema.safeParse({
      teamName: "Null Pointers",
      track: "Track A",
      members: [
        {
          ...m(ids[0]!, 1),
          id: "nope",
        },
        {
          ...m(ids[1]!, 2),
          phone: "123",
        },
        m(ids[2]!, 3),
      ],
    });

    expect(r.error?.issues.map((i) => i.path.join("."))).toEqual([
      "members.0.id",
      "members.1.phone",
    ]);
  });
});

describe("submissionSchema", () => {
  it("accepts a repo link, turns an empty demo link into null, trims notes", () => {
    expect(
      submissionSchema.parse({
        repoUrl: "https://github.com/a/b",
        demoUrl: "",
        notes: "  hi ",
      }),
    ).toEqual({
      repoUrl: "https://github.com/a/b",
      demoUrl: null,
      notes: "hi",
    });
  });

  it("requires https links and limits notes", () => {
    const r = submissionSchema.safeParse({
      repoUrl: "github.com/a/b",
      demoUrl: "http://x.dev",
      notes: "x".repeat(2001),
    });

    expect(r.error?.issues.map((i) => i.path[0])).toEqual([
      "repoUrl",
      "demoUrl",
      "notes",
    ]);
  });
});

describe("isEpisodeZeroOpen", () => {
  const now = new Date("2026-10-10T12:00:00Z");

  it("is open with no deadline or before it, closed after it", () => {
    expect(isEpisodeZeroOpen(now, undefined)).toBe(true);

    expect(isEpisodeZeroOpen(now, "")).toBe(true);

    expect(
      isEpisodeZeroOpen(
        now,
        "2026-10-15T23:59:00+05:30",
      ),
    ).toBe(true);

    expect(
      isEpisodeZeroOpen(
        now,
        "2026-10-01T00:00:00Z",
      ),
    ).toBe(false);
  });
});