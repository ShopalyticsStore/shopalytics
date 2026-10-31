"use client";

/**
 * The browser-side uTrace extension point.
 *
 * `UTraceGate` is the browser SDK's Next.js App Router helper. In the preview
 * profile it starts the activation gate during the first client module
 * evaluation — before any application client component renders — and withholds
 * the application subtree until the shared observation runtime is `ready`, so
 * the beginning of the workflow cannot escape observation. If activation fails
 * it renders the blocked surface and never renders the application as an
 * unobserved substitute.
 *
 * In the production profile it imports no runtime at all: the gate's dynamic
 * import lives inside its preview branch, and the annotation surface it hands
 * back is inert.
 *
 * Everything the SDK needs beyond the five public configuration fields — the
 * client, the uTrace User, the customer account, the Interview Session, the
 * preview environment and allocation, the manifest and policy versions —
 * arrives inside the signed document attestation, which the preview front door
 * relays from the control plane.
 */

import { UTraceGate } from "@utrace/browser-sdk/next";
import { LoaderCircle } from "lucide-react";

import { Logo } from "@/components/Logo";

import type { UTraceProfile } from "./profile";

export interface UTracePreviewGateProps {
  readonly profile: UTraceProfile;
  readonly sdkInstallationId: string;
  readonly clientReleaseId: string;
  readonly children: React.ReactNode;
}

/** The browser observation schema and protocol majors this build speaks. */
const SCHEMA_VERSION = "1";
const PROTOCOL_VERSION = "1";

export function UTracePreviewGate(props: UTracePreviewGateProps): React.ReactElement {
  return (
    <UTraceGate
      profile={props.profile}
      config={{
        sdkInstallationId: props.sdkInstallationId,
        environmentName: "preview",
        clientReleaseId: props.clientReleaseId,
        schemaVersion: SCHEMA_VERSION,
        protocolVersion: PROTOCOL_VERSION,
      }}
      pending={<PreviewPreparing />}
      renderFailure={(error) => <PreviewBlocked message={error.message} />}
    >
      {props.children}
    </UTraceGate>
  );
}

/** Shown for the few seconds activation takes, so the wait reads as loading rather than a fault. */
function PreviewPreparing(): React.ReactElement {
  return (
    <div
      role="status"
      data-testid="utrace-preview-preparing"
      className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-sm text-muted-foreground"
    >
      <Logo className="size-12" />
      <span className="flex items-center gap-2">
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        Preparing your Shopalytics preview…
      </span>
    </div>
  );
}

function PreviewBlocked({ message }: { message: string }): React.ReactElement {
  return (
    <div
      role="alert"
      data-testid="utrace-preview-blocked"
      className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center"
    >
      <p className="text-sm font-medium">This Shopalytics preview cannot start.</p>
      <p className="max-w-lg text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
