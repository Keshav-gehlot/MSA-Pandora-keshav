import { z } from "zod";
import { TEAM_SIZE } from "../config";
import {
  memberSchema,
  teamNameSchema,
  trackSchema,
} from "../rules";

export const teamEditSchema = z.object({
  teamName: teamNameSchema,
  track: trackSchema,
  members: z
    .array(
      memberSchema.extend({
        id: z.uuid(),
      }),
    )
    .min(TEAM_SIZE.min)
    .max(TEAM_SIZE.max),
});

export const submissionSchema = z.object({
  repoUrl: z
    .string()
    .refine(
      (value) => {
        try {
          return new URL(value).protocol === "https:";
        } catch {
          return false;
        }
      },
      "Repository URL must be a valid HTTPS URL",
    ),

  demoUrl: z
    .union([
      z
        .string()
        .refine(
          (value) => {
            try {
              return new URL(value).protocol === "https:";
            } catch {
              return false;
            }
          },
          "Demo URL must be a valid HTTPS URL",
        ),
      z.literal(""),
    ])
    .transform((value) => (value === "" ? null : value)),

  notes: z.string().trim().max(2000),
});

export type SubmissionInput = z.input<typeof submissionSchema>;

export type Submission = z.output<typeof submissionSchema>;

export function isEpisodeZeroOpen(
  now: Date,
  deadline: string | undefined,
): boolean {
  if (!deadline) {
    return true;
  }

  return now.getTime() < new Date(deadline).getTime();
}