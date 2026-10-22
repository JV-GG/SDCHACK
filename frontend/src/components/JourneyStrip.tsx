import type { ClaimsReadinessPackage } from "@/types/claim";
import { JOURNEY_STEPS, eligibleGrants } from "@/lib/ClaimContext";
import { formatMYR } from "@/lib/format";

type StepState = "done" | "current" | "waiting";

interface StepView {
  title: (typeof JOURNEY_STEPS)[number];
  state: StepState;
  detail: string;
}

function buildSteps(claim: ClaimsReadinessPackage, pipeline: { running: boolean; step: number }): StepView[] {
  const eligible = eligibleGrants(claim);
  const lead = eligible[0];
  const status = claim.status;
  const drafted = claim.narratives.length;

  const details = [
    `Invoice ${claim.invoice.invoiceNumber} detected`,
    "SSM, Orbyte HR and accounting pulled",
    lead
      ? `${eligible.length} of ${claim.evaluations.length} grants matched, ${drafted} ${drafted === 1 ? "narrative" : "narratives"} drafted`
      : `${claim.evaluations.length} grants checked, none matched`,
    status === "EVALUATED"
      ? lead
        ? `Waiting for the owner to sign off ${formatMYR(claim.totalClaimableAmountMYR)}`
        : "Nothing to approve"
      : "Signed off by the business owner",
    !lead
      ? "No packet without a matching grant"
      : status === "SUBMITTED"
        ? "Packet exported for submission"
        : status === "APPROVED"
          ? "Packet ready to export"
          : "Packet is built after sign-off",
  ];

  if (pipeline.running) {
    const pending = [
      "Listening for the expense",
      "Pulling SSM, Orbyte HR and accounting",
      "Running rules and drafting the narrative",
    ];
    return JOURNEY_STEPS.map((title, i) => ({
      title,
      state: i < pipeline.step ? "done" : i === pipeline.step ? "current" : "waiting",
      detail: i <= 2 ? (i < pipeline.step ? details[i] : pending[i]) : "Waiting",
    }));
  }

  const humanState: StepState = !lead ? "waiting" : status === "EVALUATED" ? "current" : "done";
  const outcomeState: StepState =
    !lead ? "waiting" : status === "SUBMITTED" ? "done" : status === "APPROVED" ? "current" : "waiting";
  const states: StepState[] = ["done", "done", "done", humanState, outcomeState];
  return JOURNEY_STEPS.map((title, i) => ({ title, state: states[i], detail: details[i] }));
}

const DOT: Record<StepState, string> = {
  done: "bg-accent",
  current: "border-2 border-accent bg-surface",
  waiting: "bg-control",
};

const STATE_WORD: Record<StepState, string> = {
  done: "Done",
  current: "In progress",
  waiting: "Waiting",
};

/**
 * The product's own element: the five-step claim journey with the live state of each step.
 * Steps run left to right on a wide screen and top to bottom on a phone.
 */
export function JourneyStrip({
  claim,
  pipeline,
}: {
  claim: ClaimsReadinessPackage;
  pipeline: { running: boolean; step: number };
}) {
  const steps = buildSteps(claim, pipeline);
  return (
    <section aria-label="Claim journey" className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <h2 className="text-section font-semibold">Claim journey</h2>
      <ol className="mt-4 grid gap-5 lg:grid-cols-5 lg:gap-4">
        {steps.map((s, i) => (
          <li key={s.title} className="relative flex gap-3 lg:block">
            <div className="flex-none lg:mb-3 lg:h-3">
              <span aria-hidden="true" className={`relative z-10 block size-3 rounded-full ${DOT[s.state]}`} />
            </div>
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={`absolute bottom-[-20px] left-[5px] top-3 w-0.5 lg:bottom-auto lg:left-3 lg:right-[-16px] lg:top-[5px] lg:h-0.5 lg:w-auto ${
                  s.state === "done" ? "bg-accent" : "bg-active"
                }`}
              />
            )}
            <div className="min-w-0">
              <p className="font-semibold">
                {s.title}
                <span className="sr-only">: {STATE_WORD[s.state]}</span>
              </p>
              <p className="mt-0.5 text-small text-muted">{s.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
