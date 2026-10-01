"use client";

import { useEffect, useState } from "react";

import {
  Banner,
  Button,
  FileInput,
  Heading,
  Selector,
  Step,
  Stepper,
  Text,
  TextInput,
} from "@pandora/ui";

import {
  checkUpload,
  memberSchema,
  registrationSchema,
  teamStepSchema,
  TRACKS,
  UPLOADS,
  type RegistrationInput,
} from "@pandora/core";

import {
  checkTeamName,
  sendRegistrationCode,
  submitRegistration,
  verifyRegistrationCode,
} from "./actions";


const STORAGE_KEY = "pandora-registration-v1";

const MEMBER_FIELDS = [
  { key: "firstName", label: "First name", type: "text" },
  { key: "lastName", label: "Last name", type: "text" },
  { key: "regNumber", label: "Registration number", type: "text" },
  { key: "srmEmail", label: "SRM email", type: "email" },
  { key: "personalEmail", label: "Personal email", type: "email" },
  { key: "phone", label: "Phone number", type: "tel" },
] as const;

type MemberField = (typeof MEMBER_FIELDS)[number]["key"];

type RegistrationStep =
  | "team"
  | "leader"
  | "member-2"
  | "member-3"
  | "member-4"
  | "review"
  | "payment"
  | "done";

type EditableStep = Exclude<
  RegistrationStep,
  "review" | "payment" | "done"
>;

type RegistrationFormProps = {
  paymentEnabled: boolean;
};

const emptyMember = (): RegistrationInput["members"][number] => ({
  firstName: "",
  lastName: "",
  regNumber: "",
  srmEmail: "",
  personalEmail: "",
  phone: "",
});

const emptyRegistration = (): RegistrationInput => ({
  teamName: "",
  track: "Track A",
  members: [emptyMember(), emptyMember(), emptyMember()],
});

const stepOrder: RegistrationStep[] = [
  "team",
  "leader",
  "member-2",
  "member-3",
  "member-4",
  "review",
  "payment",
  "done",
];

function isRegistrationStep(value: unknown): value is RegistrationStep {
  return (
    typeof value === "string" &&
    stepOrder.includes(value as RegistrationStep)
  );
}

function isMemberField(value: unknown): value is MemberField {
  return MEMBER_FIELDS.some((field) => field.key === value);
}

function stepTitle(step: RegistrationStep): string {
  switch (step) {
    case "team":
      return "Step 1 — Team details";
    case "leader":
      return "Step 2 — Team Leader";
    case "member-2":
      return "Step 3 — Member 2";
    case "member-3":
      return "Step 4 — Member 3";
    case "member-4":
      return "Step 5 — Member 4";
    case "review":
      return "Step 6 — Review";
    case "payment":
      return "Step 7 — Payment";
    case "done":
      return "Registration complete";
  }
}

function stepForMemberIndex(index: number): EditableStep {
  switch (index) {
    case 0:
      return "leader";
    case 1:
      return "member-2";
    case 2:
      return "member-3";
    default:
      return "member-4";
  }
}

function getActiveStepIndex(
  step: RegistrationStep,
  paymentEnabled: boolean,
): number {
  if (step === "done") {
    return paymentEnabled ? 7 : 6;
  }

  if (!paymentEnabled && step === "payment") {
    return 5;
  }

  const index = stepOrder.indexOf(step);

  if (!paymentEnabled && index > 5) {
    return index - 1;
  }

  return index;
}
type PersistedMember = Partial<
  RegistrationInput["members"][number]
>;

type PersistedRegistration = {
  teamName?: unknown;
  track?: unknown;
  members?: unknown;
};

type PersistedData = {
  registration?: unknown;
  step?: unknown;
};

function restorePartialRegistration(
  value: unknown,
): RegistrationInput {
  const empty = emptyRegistration();

  if (
    typeof value !== "object" ||
    value === null
  ) {
    return empty;
  }

  const saved =
    value as PersistedRegistration;

  const registration: RegistrationInput = {
    ...empty,
    teamName:
      typeof saved.teamName === "string"
        ? saved.teamName
        : empty.teamName,
    track:
      typeof saved.track === "string" &&
      TRACKS.includes(
        saved.track as RegistrationInput["track"],
      )
        ? (saved.track as RegistrationInput["track"])
        : empty.track,
    members: [...empty.members],
  };

  if (Array.isArray(saved.members)) {
    registration.members = saved.members
      .slice(0, 4)
      .map((value, index) => {
        const member =
          empty.members[index] ?? emptyMember();

        if (
          typeof value !== "object" ||
          value === null
        ) {
          return member;
        }

        const savedMember =
          value as PersistedMember;

        return {
          ...member,
          firstName:
            typeof savedMember.firstName ===
            "string"
              ? savedMember.firstName
              : "",
          lastName:
            typeof savedMember.lastName ===
            "string"
              ? savedMember.lastName
              : "",
          regNumber:
            typeof savedMember.regNumber ===
            "string"
              ? savedMember.regNumber
              : "",
          srmEmail:
            typeof savedMember.srmEmail ===
            "string"
              ? savedMember.srmEmail
              : "",
          personalEmail:
            typeof savedMember.personalEmail ===
            "string"
              ? savedMember.personalEmail
              : "",
          phone:
            typeof savedMember.phone ===
            "string"
              ? savedMember.phone
              : "",
        };
      });

    while (registration.members.length < 3) {
      registration.members.push(
        emptyMember(),
      );
    }
  }

  return registration;
}
export function RegistrationForm({
  paymentEnabled,
}: RegistrationFormProps) {
const [registration, setRegistration] =
    useState<RegistrationInput>(emptyRegistration);

  const [step, setStep] = useState<RegistrationStep>("team");
  const [editingStep, setEditingStep] = useState<EditableStep | null>(null);
  const [storageHydrated, setStorageHydrated] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [teamNameAvailable, setTeamNameAvailable] = useState<boolean | null>(
    null,
  );

const [leaderEmailCode, setLeaderEmailCode] = useState("");
const [leaderCodeSent, setLeaderCodeSent] = useState(false);
const [leaderCodeError, setLeaderCodeError] = useState<string | null>(null);
const [leaderVerified, setLeaderVerified] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [paymentProofError, setPaymentProofError] = useState<string | null>(
    null,
  );

  const [memberPhotos, setMemberPhotos] = useState<Array<File | null>>([
    null,
    null,
    null,
  ]);

  const [memberPhotoPreviews, setMemberPhotoPreviews] = useState<string[]>(
    [],
  );

  const [submitting, setSubmitting] = useState(false);
  const [submittedTeamName, setSubmittedTeamName] = useState("");

useEffect(() => {
  let restoredRegistration = emptyRegistration();
  let restoredStep: RegistrationStep = "team";

  try {
    const saved = window.localStorage.getItem(
      STORAGE_KEY,
    );

    if (saved) {
      const parsed: unknown = JSON.parse(saved);

      if (
        typeof parsed === "object" &&
        parsed !== null
      ) {
        const data = parsed as PersistedData;

        restoredRegistration =
          restorePartialRegistration(
            data.registration,
          );

        if (
          isRegistrationStep(data.step) &&
          data.step !== "done"
        ) {
          if (
            !paymentEnabled &&
            data.step === "payment"
          ) {
            restoredStep = "review";
          } else {
            restoredStep = data.step;
          }
        }
      }
    }
  } catch {
    // Ignore invalid or unavailable localStorage data.
  }

  window.setTimeout(() => {
    setRegistration(restoredRegistration);
    setStep(restoredStep);
    setStorageHydrated(true);
  }, 0);
}, [paymentEnabled]);

  useEffect(() => {
    if (!storageHydrated || step === "done") {
      return;
    }

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          registration,
          step,
        }),
      );
    } catch {
      // Ignore unavailable localStorage.
    }
  }, [registration, step, storageHydrated]);

  useEffect(() => {
    const teamName = registration.teamName.trim();

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      if (teamName.length < 3) {
        if (!cancelled) {
          setTeamNameAvailable(null);
        }

        return;
      }

      try {
        const result = await checkTeamName(teamName);

        if (!cancelled) {
          setTeamNameAvailable(result.available);
        }
      } catch {
        if (!cancelled) {
          setTeamNameAvailable(null);
        }
      }
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [registration.teamName]);

  useEffect(() => {
    const urls = memberPhotos.map((photo) =>
      photo ? URL.createObjectURL(photo) : "",
    );

    queueMicrotask(() => {
      setMemberPhotoPreviews(urls);
    });

    return () => {
      urls.forEach((url) => {
        if (url) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [memberPhotos]);

  useEffect(() => {
    if (resendSeconds <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  function clearErrors() {
    setError(null);
    setFieldErrors({});
  }

  function setFieldError(key: string, message: string) {
    setFieldErrors((current) => ({
      ...current,
      [key]: message,
    }));

    setError(null);
  }

  function clearFieldError(key: string) {
    setFieldErrors((current) => {
      if (!(key in current)) {
        return current;
      }

      const next = { ...current };
      delete next[key];

      return next;
    });
  }

  function memberFieldError(
    index: number,
    field: MemberField,
  ): string | null {
    return fieldErrors[`member-${index}-${field}`] ?? null;
  }

  function applyMemberValidationError(
    index: number,
    result: ReturnType<typeof memberSchema.safeParse>,
    fallback: string,
  ): boolean {
    if (result.success) {
      return true;
    }

    const issue = result.error.issues[0];
    const field = issue?.path[0];

    if (isMemberField(field)) {
      setFieldError(
        `member-${index}-${field}`,
        issue?.message ?? fallback,
      );
    } else {
      setError(issue?.message ?? fallback);
    }

    return false;
  }

  function updateMember(
    index: number,
    field: MemberField,
    value: string,
  ) {
    setRegistration((current) => ({
      ...current,
      members: current.members.map((member, currentIndex) =>
        currentIndex === index
          ? { ...member, [field]: value }
          : member,
      ),
    }));

    clearFieldError(`member-${index}-${field}`);
    setError(null);

if (index === 0 && field === "srmEmail") {
  setLeaderCodeError(null);
  setLeaderCodeSent(false);
  setLeaderVerified(false);
  setLeaderEmailCode("");
  setResendSeconds(0);
}
  }

  function finishEditableStep(
    currentStep: EditableStep,
    nextStep: RegistrationStep,
  ) {
    if (editingStep === currentStep) {
      setEditingStep(null);
      setStep("review");
      return;
    }

    setStep(nextStep);
  }

  function handleTeamContinue() {
    const result = teamStepSchema.safeParse({
      teamName: registration.teamName,
      track: registration.track,
    });

    if (!result.success) {
      const issue = result.error.issues[0];

      if (issue?.path[0] === "teamName") {
        setFieldError("teamName", issue.message);
      } else {
        setError(issue?.message ?? "Please check your team details.");
      }

      return;
    }

    if (teamNameAvailable !== true) {
      setFieldError(
        "teamName",
        "Please choose an available team name.",
      );
      return;
    }

    clearErrors();
    finishEditableStep("team", "leader");
  }

  async function handleSendLeaderCode() {
    const leader = registration.members[0];

    if (!leader) {
      return;
    }

    const result = memberSchema.safeParse(leader);

    if (
      !applyMemberValidationError(
        0,
        result,
        "Please complete the leader details before requesting a code.",
      )
    ) {
      return;
    }

    setError(null);

    try {
      const response = await sendRegistrationCode(leader.srmEmail);

if (!response.ok) {
  setLeaderCodeError(response.message);
  return;
}
      setLeaderCodeError(null);
      setLeaderCodeSent(true);
      setLeaderVerified(false);
      setLeaderEmailCode("");
      setResendSeconds(60);
} catch {
  setLeaderCodeError(
    "We couldn't send the verification code. Please try again.",
  );
}
  }

  async function handleVerifyLeaderCode() {
    const leader = registration.members[0];

    if (!leader) {
      return;
    }

    try {
      const response = await verifyRegistrationCode(
        leader.srmEmail,
        leaderEmailCode,
      );

if (!response.ok) {
  setLeaderCodeError(response.message);
  return;
}

setLeaderCodeError(null);
setLeaderVerified(true);
} catch {
  setLeaderCodeError(
    "We couldn't verify the code. Please try again.",
  );
}
  }

  function handleLeaderContinue() {
    const leader = registration.members[0];

    if (!leader) {
      return;
    }

    if (!leaderVerified) {
      setError("Verify your SRM email before continuing.");
      return;
    }

    const result = memberSchema.safeParse(leader);

    if (
      !applyMemberValidationError(
        0,
        result,
        "Please check the leader details.",
      )
    ) {
      return;
    }

    clearErrors();
    finishEditableStep("leader", "member-2");
  }

  function validateLocalDuplicates(): boolean {
    const fields: Array<"regNumber" | "srmEmail"> = [
      "regNumber",
      "srmEmail",
    ];

    for (const field of fields) {
      const duplicateIndex = findLocalDuplicateIndex(field);

      if (duplicateIndex !== null) {
        const fieldLabel =
          field === "regNumber"
            ? "registration number"
            : "SRM email";

        const duplicateMember = registration.members.findIndex(
          (member, index) =>
            index !== duplicateIndex &&
            member[field].trim().toLowerCase() ===
              registration.members[duplicateIndex]![field]
                .trim()
                .toLowerCase(),
        );

        const duplicateLabel =
          duplicateMember === 0
            ? "the team leader"
            : `Member ${duplicateMember + 1}`;

        setFieldError(
          `member-${duplicateIndex}-${field}`,
          `This ${fieldLabel} is already used by ${duplicateLabel}.`,
        );

        setStep(stepForMemberIndex(duplicateIndex));

        return false;
      }
    }

    return true;
  }

  function handleMemberContinue(
    memberIndex: number,
    nextStep: RegistrationStep,
    memberLabel: string,
  ) {
    const member = registration.members[memberIndex];

    if (!member) {
      return;
    }

    const result = memberSchema.safeParse(member);

    if (
      !applyMemberValidationError(
        memberIndex,
        result,
        `Please check ${memberLabel} details.`,
      )
    ) {
      return;
    }

    if (!validateLocalDuplicates()) {
      return;
    }

    clearErrors();

    finishEditableStep(
      stepForMemberIndex(memberIndex),
      nextStep,
    );
  }

  function handleAddMemberFour() {
    setRegistration((current) => {
      if (current.members.length >= 4) {
        return current;
      }

      return {
        ...current,
        members: [...current.members, emptyMember()],
      };
    });

    setMemberPhotos((current) => [...current, null]);
    clearErrors();
    setEditingStep(null);
    setStep("member-4");
  }

  function handleRemoveMemberFour() {
    if (registration.members.length < 4) {
      return;
    }

    setRegistration((current) => ({
      ...current,
      members: current.members.slice(0, 3),
    }));

    setMemberPhotos((current) => current.slice(0, 3));
    clearErrors();
    setEditingStep(null);

    setStep("review");
  }

  function handleSkipMemberFour() {
    clearErrors();

    if (
      editingStep === "member-3" ||
      editingStep === "member-4"
    ) {
      setEditingStep(null);
    }

    setStep("review");
  }

  function handleMemberFourContinue() {
    const member = registration.members[3];

    if (!member) {
      return;
    }

    const result = memberSchema.safeParse(member);

    if (
      !applyMemberValidationError(
        3,
        result,
        "Please check Member 4 details.",
      )
    ) {
      return;
    }

    if (!validateLocalDuplicates()) {
      return;
    }

    clearErrors();
    setEditingStep(null);

    setStep("review");
  }

function handlePhotoChange(
  index: number,
  file: File | null,
) {
  clearFieldError(`member-${index}-photo`);

  if (!file) {
    setMemberPhotos((current) =>
      current.map((photo, photoIndex) =>
        photoIndex === index ? null : photo,
      ),
    );

    return;
  }

  const checked = checkUpload("photo", {
    type: file.type,
    size: file.size,
  });

  if (!checked.ok) {
    setFieldError(
      `member-${index}-photo`,
      checked.message,
    );
    return;
  }

  setMemberPhotos((current) =>
    current.map((photo, photoIndex) =>
      photoIndex === index ? file : photo,
    ),
  );
}

  function editStep(targetStep: EditableStep) {
    clearErrors();
    setEditingStep(targetStep);
    setStep(targetStep);
  }

  function handleReviewContinue() {
    clearErrors();

    if (!validateLocalDuplicates()) {
      return;
    }

    if (!leaderVerified) {
      setError(
        "Verify the team leader's SRM email before submitting.",
      );

      setStep("leader");
      return;
    }

    if (paymentEnabled) {
      setStep("payment");
      return;
    }

    void handleSubmit();
  }

  function handlePaymentProofChange(file: File | null) {
    setPaymentProofError(null);

    if (!file) {
      setPaymentProof(null);
      return;
    }

    const checked = checkUpload("paymentProof", {
      type: file.type,
      size: file.size,
    });

    if (!checked.ok) {
      setPaymentProof(null);
      setPaymentProofError(checked.message);
      return;
    }

    setPaymentProof(file);
  }

  function findLocalDuplicateIndex(
    field: "regNumber" | "srmEmail",
  ): number | null {
    const seen = new Map<string, number>();

    for (
      let index = 0;
      index < registration.members.length;
      index += 1
    ) {
      const value = registration.members[index]?.[field]
        .trim()
        .toLowerCase();

      if (!value) {
        continue;
      }

      const previousIndex = seen.get(value);

      if (previousIndex !== undefined) {
        return index;
      }

      seen.set(value, index);
    }

    return null;
  }

function getStepForField(
  field: "teamName" | "regNumber" | "srmEmail",
): RegistrationStep {
  if (field === "teamName") {
    return "team";
  }

  const duplicateIndex = findLocalDuplicateIndex(field);

  if (duplicateIndex !== null) {
    return stepForMemberIndex(duplicateIndex);
  }

  return "leader";
}

  async function handleSubmit() {
    if (submitting) {
      return;
    }

    const parsed = registrationSchema.safeParse(registration);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue?.path;

      const memberIndex =
        typeof path?.[0] === "string" &&
        path[0] === "members" &&
        typeof path[1] === "number"
          ? path[1]
          : null;

      const memberField =
        memberIndex !== null ? path?.[2] : null;

      if (
        memberIndex !== null &&
        isMemberField(memberField)
      ) {
        setFieldError(
          `member-${memberIndex}-${memberField}`,
          issue?.message ?? "Please check this field.",
        );

        setStep(stepForMemberIndex(memberIndex));
      } else if (path?.[0] === "teamName") {
        setFieldError(
          "teamName",
          issue?.message ?? "Please check the team name.",
        );

        setStep("team");
      } else {
        setError(
          issue?.message ??
            "Please check your registration details.",
        );
      }

      return;
    }

    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      const formData = new FormData();

      formData.set(
        "registration",
        JSON.stringify(registration),
      );

      if (paymentProof) {
        formData.set("paymentProof", paymentProof);
      }

      memberPhotos.forEach((photo, index) => {
        if (photo) {
          formData.set(`photo-${index}`, photo);
        }
      });

      const result = await submitRegistration(formData);

if (!result.ok) {
  if (result.field === "teamName") {
    setFieldError("teamName", result.message);
    setStep("team");
  } else if (
    result.field === "regNumber" ||
    result.field === "srmEmail"
  ) {
    setFieldError(
      `member-0-${result.field}`,
      result.message,
    );
    setStep(getStepForField(result.field));
  } else {
    setError(result.message);
  }

  return;
}

      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore unavailable localStorage.
      }

      setSubmittedTeamName(result.teamName);
      setEditingStep(null);
      setStep("done");

      setRegistration(emptyRegistration());
      setMemberPhotos([null, null, null]);
      setMemberPhotoPreviews([]);
      setPaymentProof(null);
      setPaymentProofError(null);
      setLeaderEmailCode("");
      setLeaderCodeSent(false);
      setLeaderVerified(false);
      setResendSeconds(0);
    } catch {
      setError(
        "Something went wrong while submitting your registration. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function renderMemberFields(
    index: number,
    memberLabel: string,
  ) {
    const member = registration.members[index];

    if (!member) {
      return null;
    }

    return (
      <>
        {MEMBER_FIELDS.map(({ key, label, type }) => {
const fieldError = memberFieldError(
  index,
  key,
);

const statusMessage =
  fieldError ??
  (index === 0 && key === "srmEmail"
    ? leaderCodeError
    : null);

          const inputId = `${memberLabel
            .toLowerCase()
            .replace(/\s+/g, "-")}-${key}`;

          return (
            <TextInput
              key={key}
              id={inputId}
              type={
                type === "email"
                  ? "email"
                  : "text"
              }
              value={member[key]}
              label={`${label} *`}
              isRequired
              placeholder={
                key === "regNumber"
                  ? "RA2611026010690"
                  : key === "srmEmail"
                    ? "yourname@srmist.edu.in"
                    : key === "personalEmail"
                      ? "you@example.com"
                      : key === "phone"
                        ? "10-digit mobile number"
                        : `Enter ${label.toLowerCase()}`
              }
status={
  statusMessage
    ? {
        type: "error",
        message: statusMessage,
      }
    : undefined
}
              onChange={(value) =>
                updateMember(
                  index,
                  key,
                  value,
                )
              }
            />
          );
        })}
      </>
    );
  }
    function renderMemberPhoto(index: number) {
    const member = registration.members[index];

    if (!member) {
      return null;
    }

    const inputId = `photo-${index}`;

    return (
      <div>
        <FileInput
          id={inputId}
          label={`${member.firstName || `Member ${index + 1}`} photo (optional)`}
          value={memberPhotos[index] ?? null}
          accept={UPLOADS.photo.types.join(",")}
          maxSize={UPLOADS.photo.maxBytes}
          status={
  fieldErrors[`member-${index}-photo`]
    ? {
        type: "error",
        message: fieldErrors[`member-${index}-photo`],
      }
    : undefined
}
          onChange={(files) => {
            const file = Array.isArray(files)
              ? files[0] ?? null
              : files;

            handlePhotoChange(index, file);
          }}
        />

        {memberPhotos[index] ? (
          <div>
            {memberPhotoPreviews[index] ? (
              <img
                src={memberPhotoPreviews[index]}
                alt={`${member.firstName || `Member ${index + 1}`} photo preview`}
                width={160}
                height={160}
                style={{
                  objectFit: "cover",
                  borderRadius: "8px",
                }}
              />
            ) : null}

            <Text type="supporting" as="p">
              {memberPhotos[index]?.name} (
              {Math.round(
                (memberPhotos[index]?.size ?? 0) / 1024,
              )}{" "}
              KB)
            </Text>
          </div>
        ) : null}
      </div>
    );
  }

const leader = registration.members[0];
const memberTwo = registration.members[1];
const memberThree = registration.members[2];
const memberFour = registration.members[3];

  if (step === "done") {
    return (
<div>
  <Heading level={2}>Registration complete</Heading>

  <Text type="body" as="p">
    Your team{" "}
    <strong>{submittedTeamName}</strong>{" "}
    has been registered successfully.
  </Text>

  <Text type="body" as="p">
    A confirmation email will be sent to
    the registered team members.
  </Text>
</div>
    );
  }

  const activeStepIndex = getActiveStepIndex(
    step,
    paymentEnabled,
  );

  return (
    <div>
<Heading level={2}>Registration</Heading>

<Text type="supporting" as="p">
  {stepTitle(step)}
</Text>

      <Stepper
        activeStep={activeStepIndex}
        label="Registration progress"
        orientation="horizontal"
      >
        <Step
          step={0}
          label="Team"
          status={
            activeStepIndex > 0
              ? "success"
              : undefined
          }
        />

        <Step
          step={1}
          label="Leader"
          status={
            activeStepIndex > 1
              ? "success"
              : undefined
          }
        />

        <Step
          step={2}
          label="Member 2"
          status={
            activeStepIndex > 2
              ? "success"
              : undefined
          }
        />

        <Step
          step={3}
          label="Member 3"
          status={
            activeStepIndex > 3
              ? "success"
              : undefined
          }
        />

        <Step
          step={4}
          label="Member 4"
          isOptional
          status={
            activeStepIndex > 4
              ? "success"
              : undefined
          }
        />

        <Step
          step={5}
          label="Review"
          status={
            activeStepIndex > 5
              ? "success"
              : undefined
          }
        />

        {paymentEnabled ? (
          <Step
            step={6}
            label="Payment"
            status={
              activeStepIndex > 6
                ? "success"
                : undefined
            }
          />
        ) : null}
      </Stepper>

{error ? (
  <Banner
    status="error"
    title="Something needs your attention"
    description={error}
    collapsible={false}
  />
) : null}

      {step === "team" ? (
        <section aria-labelledby="team-step-heading">
<Heading level={3} id="team-step-heading">
  Team details
</Heading>

          <TextInput
            id="team-name"

            type="text"
            label="Team name *"
            isRequired
            value={registration.teamName}
            placeholder="Enter your team name"
            status={
              fieldErrors.teamName
                ? {
                    type: "error",
                    message:
                      fieldErrors.teamName,
                  }
                : teamNameAvailable === false
                  ? {
                      type: "error",
                      message:
                        "Team name is already taken.",
                    }
                  : teamNameAvailable === true
                    ? {
                        type: "success",
                        message:
                          "Team name is available.",
                      }
                    : undefined
            }
            onChange={(value) => {
              setRegistration(
                (current) => ({
                  ...current,
                  teamName: value,
                }),
              );

              setTeamNameAvailable(null);
              clearFieldError("teamName");
              setError(null);
            }}
          />

          <Selector
            id="track"

            label="Track *"
            isRequired
            value={registration.track}
            options={TRACKS.map(
              (track) => ({
                value: track,
                label: track,
              }),
            )}
            onChange={(value) => {
              if (!value) {
                return;
              }

              setRegistration(
                (current) => ({
                  ...current,
                  track: value as RegistrationInput["track"],
                }),
              );

              setError(null);
            }}
          />

<Button
  type="button"
  variant="primary"
  label={
    editingStep === "team"
      ? "Save team details"
      : "Continue"
  }
  onClick={handleTeamContinue}
>
  {editingStep === "team"
    ? "Save team details"
    : "Continue"}
</Button>
        </section>
      ) : null}

      {step === "leader" ? (
        <section aria-labelledby="leader-step-heading">
<Heading level={3} id="leader-step-heading">
  Team Leader
</Heading>

          {renderMemberFields(
            0,
            "leader",
          )}
          {renderMemberPhoto(0)}

          <Button
  type="button"
  variant="secondary"
  label={
    leaderVerified
      ? "Email verified"
      : resendSeconds > 0
        ? `Resend code in ${resendSeconds}s`
        : leaderCodeSent
          ? "Send code again"
          : "Send code"
  }
  isDisabled={
    resendSeconds > 0 ||
    leaderVerified
  }
  onClick={handleSendLeaderCode}
>
  {leaderVerified
    ? "Email verified"
    : resendSeconds > 0
      ? `Resend code in ${resendSeconds}s`
      : leaderCodeSent
        ? "Send code again"
        : "Send code"}
</Button>

          {leaderCodeSent ? (
            <div>
<TextInput
  id="leader-verification-code"
  type="text"
  label="Verification code *"
  status={
    leaderCodeError
      ? {
          type: "error",
          message: leaderCodeError,
        }
      : undefined
  }
                isRequired
                value={leaderEmailCode}
                placeholder="6-digit code"
onChange={(value) => {
  setLeaderEmailCode(
    value
      .replace(/\D/g, "")
      .slice(0, 6),
  );

  setLeaderCodeError(null);
}}
              />

<Button
  type="button"
  variant="secondary"
  label={
    leaderVerified
      ? "Verified"
      : "Verify code"
  }
  isDisabled={
    leaderEmailCode.length !== 6 ||
    leaderVerified
  }
  onClick={handleVerifyLeaderCode}
>
  {leaderVerified
    ? "Verified"
    : "Verify code"}
</Button>
            </div>
          ) : null}

{leaderVerified ? (
  <Banner
    status="success"
    title="SRM email verified"
    collapsible={false}
  />
) : null}

<Button
  type="button"
  variant="primary"
  label={
    editingStep === "leader"
      ? "Save team leader"
      : "Continue to Member 2"
  }
  isDisabled={!leaderVerified}
  onClick={handleLeaderContinue}
>
  {editingStep === "leader"
    ? "Save team leader"
    : "Continue to Member 2"}
</Button>
        </section>
      ) : null}

      {step === "member-2" ? (
        <section aria-labelledby="member-two-heading">
  <Heading level={3} id="member-two-heading">
  Member 2
</Heading>

          {renderMemberFields(
            1,
            "member-two",
          )}
          {renderMemberPhoto(1)}

<Button
  type="button"
  variant="primary"
  label={
    editingStep === "member-2"
      ? "Save Member 2"
      : "Continue to Member 3"
  }
  onClick={() =>
    handleMemberContinue(
      1,
      "member-3",
      "Member 2",
    )
  }
>
  {editingStep === "member-2"
    ? "Save Member 2"
    : "Continue to Member 3"}
</Button>
        </section>
      ) : null}

      {step === "member-3" ? (
        <section aria-labelledby="member-three-heading">
<Heading level={3} id="member-three-heading">
  Member 3
</Heading>

          {renderMemberFields(
            2,
            "member-three",
          )}
          {renderMemberPhoto(2)}

         <Button
  type="button"
  variant="primary"
  label={
    editingStep === "member-3"
      ? "Save Member 3"
      : "Continue to Member 4"
  }
  onClick={() =>
    handleMemberContinue(
      2,
      "member-4",
      "Member 3",
    )
  }
>
  {editingStep === "member-3"
    ? "Save Member 3"
    : "Continue to Member 4"}
</Button>

          <Button
  type="button"
  variant="ghost"
  label="Skip, we’re a team of 3"
  onClick={handleSkipMemberFour}
>
  Skip, we’re a team of 3
</Button>
        </section>
      ) : null}

      {step === "member-4" ? (
        <section aria-labelledby="member-four-heading">
<Heading level={3} id="member-four-heading">
  Member 4
</Heading>

          {registration.members.length < 4 ? (
            <>
              <p>
                Add an optional fourth member
                to your team.
              </p>

<Button
  type="button"
  variant="primary"
  label="Add Member 4"
  onClick={handleAddMemberFour}
>
  Add Member 4
</Button>

<Button
  type="button"
  variant="ghost"
  label="Skip, we’re a team of 3"
  onClick={handleSkipMemberFour}
>
  Skip, we’re a team of 3
</Button>
            </>
          ) : (
            <>
              {renderMemberFields(
                3,
                "member-four",
              )}
              {renderMemberPhoto(3)}
<Button
  type="button"
  variant="primary"
  label={
    editingStep === "member-4"
      ? "Save Member 4"
      : "Continue to Review"
  }
  onClick={handleMemberFourContinue}
>
  {editingStep === "member-4"
    ? "Save Member 4"
    : "Continue to Review"}
</Button>
            </>
          )}
        </section>
      ) : null}

      {step === "review" ? (
        <section aria-labelledby="review-heading">
<Heading level={3} id="review-heading">
  Review your registration
</Heading>

          <section aria-labelledby="review-team-heading">
<Heading level={4} id="review-team-heading">
  Team details
</Heading>

            <p>
              <strong>
                Team name:
              </strong>{" "}
              {registration.teamName}
            </p>

            <p>
              <strong>Track:</strong>{" "}
              {registration.track}
            </p>

<Button
  type="button"
  variant="ghost"
  label="Edit team details"
  onClick={() => editStep("team")}
>
  Edit team details
</Button>
          </section>

          <section aria-labelledby="review-leader-heading">
<Heading level={4} id="review-leader-heading">
  Team Leader
</Heading>

            {leader ? (
              <>
                <p>
                  <strong>Name:</strong>{" "}
                  {leader.firstName}{" "}
                  {leader.lastName}
                </p>

                <p>
                  <strong>
                    Registration number:
                  </strong>{" "}
                  {leader.regNumber}
                </p>

                <p>
                  <strong>
                    SRM email:
                  </strong>{" "}
                  {leader.srmEmail}
                </p>

                <p>
                  <strong>
                    Personal email:
                  </strong>{" "}
                  {leader.personalEmail}
                </p>

                <p>
                  <strong>Phone:</strong>{" "}
                  {leader.phone}
                </p>
              </>
            ) : null}

            {leaderVerified ? (
              <p role="status">
                ✓ SRM email verified
              </p>
            ) : (
<Banner
  status="error"
  title="Email verification required"
  description="SRM email verification is required again."
  collapsible={false}
/>
            )}

<Button
  type="button"
  variant="ghost"
  label="Edit team leader"
  onClick={() => editStep("leader")}
>
  Edit team leader
</Button>
          </section>

          {[memberTwo, memberThree, memberFour].map(
            (member, offset) => {
              if (!member) {
                return null;
              }

              const index = offset + 1;
              const label = `Member ${
                index + 1
              }`;

              const headingId = `review-member-${
                index + 1
              }-heading`;

              return (
                <section
                  key={index}
                  aria-labelledby={
                    headingId
                  }
                >
<Heading level={4} id={headingId}>
  {label}
</Heading>
                  <p>
                    <strong>Name:</strong>{" "}
                    {member.firstName}{" "}
                    {member.lastName}
                  </p>

                  <p>
                    <strong>
                      Registration number:
                    </strong>{" "}
                    {member.regNumber}
                  </p>

                  <p>
                    <strong>
                      SRM email:
                    </strong>{" "}
                    {member.srmEmail}
                  </p>

                  <p>
                    <strong>
                      Personal email:
                    </strong>{" "}
                    {member.personalEmail}
                  </p>

                  <p>
                    <strong>
                      Phone:
                    </strong>{" "}
                    {member.phone}
                  </p>

<Button
  type="button"
  variant="ghost"
  label={`Edit ${label}`}
  onClick={() =>
    editStep(
      stepForMemberIndex(index),
    )
  }
>
  Edit {label}
</Button>

                  {index === 3 ? (
<Button
  type="button"
  variant="destructive"
  label="Remove Member 4"
  onClick={handleRemoveMemberFour}
>
  Remove Member 4
</Button>
                  ) : null}
                </section>
              );
            },
          )}

          {!memberFour ? (
            <section aria-labelledby="review-team-size-heading">
<Heading level={4} id="review-team-size-heading">
  Team size
</Heading>

              <p>
                Team of 3 — no fourth
                member added.
              </p>
            </section>
          ) : null}



<Button
  type="button"
  variant="primary"
  label={
    paymentEnabled
      ? "Continue to Payment"
      : "Submit Registration"
  }
  isDisabled={submitting}
  isLoading={submitting}
  onClick={handleReviewContinue}
>
  {paymentEnabled
    ? "Continue to Payment"
    : "Submit Registration"}
</Button>
        </section>
      ) : null}

      {step === "payment" ? (
        <section aria-labelledby="payment-heading">
<Heading level={3} id="payment-heading">
  Payment
</Heading>

          <p>
            Complete the payment and upload
            your payment proof.
          </p>

          <div
            aria-label="Payment QR code placeholder"
            role="img"
          >
            <p>
              Payment QR code will appear
              here.
            </p>
          </div>

          <FileInput
            id="payment-proof"
            label="Payment proof *"
            isRequired
            value={paymentProof}
            accept={UPLOADS.paymentProof.types.join(",")}
maxSize={UPLOADS.paymentProof.maxBytes}
            status={
              paymentProofError
                ? {
                    type: "error",
                    message:
                      paymentProofError,
                  }
                : undefined
            }
            onChange={(files) => {
              const file =
                Array.isArray(files)
                  ? files[0] ?? null
                  : files;

              handlePaymentProofChange(
                file,
              );
            }}
          />

          {paymentProof ? (
            <p>
              {paymentProof.name} (
              {Math.round(
                paymentProof.size /
                  1024,
              )}{" "}
              KB)
            </p>
          ) : null}

<Button
  type="button"
  variant="primary"
  label="Submit Registration"
  isDisabled={
    submitting ||
    !paymentProof
  }
  isLoading={submitting}
  onClick={() =>
    void handleSubmit()
  }
>
  Submit Registration
</Button>

<Button
  type="button"
  variant="ghost"
  label="Back to Review"
  isDisabled={submitting}
  onClick={() => {
    setError(null);
setStep("review");
  }}
>
  Back to Review
</Button>
        </section>
      ) : null}
    </div>
  );
}
