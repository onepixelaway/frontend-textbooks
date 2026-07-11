export const VERIFICATION_PROFILES = Object.freeze({
  affected: Object.freeze({ includePrint: false, captureAllPages: false, exportPdf: false }),
  full: Object.freeze({ includePrint: true, captureAllPages: true, exportPdf: true })
});

export const PIPELINE_MODES = Object.freeze({
  inventory: Object.freeze({ tier: "fast", browserProfile: null }),
  validate: Object.freeze({ tier: "fast", browserProfile: null }),
  build: Object.freeze({ tier: "fast", browserProfile: null }),
  verify: Object.freeze({ tier: "affected", browserProfile: "affected" }),
  finalize: Object.freeze({ tier: "full", browserProfile: "full" })
});

export const TIER_RANK = Object.freeze({ fast: 0, affected: 1, full: 2 });

export function verificationProfile(name) {
  const profile = VERIFICATION_PROFILES[name];
  if (!profile) throw new Error(`Unknown verification profile: ${name}`);
  return profile;
}
