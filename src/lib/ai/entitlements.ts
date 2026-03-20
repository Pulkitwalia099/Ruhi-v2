// ---------------------------------------------
// src/lib/ai/entitlements.ts
//
// type Entitlements                          L9
// maxMessagesPerHour                        L10
// export const entitlementsByIsAnonymous    L13
// ---------------------------------------------

type Entitlements = {
  maxMessagesPerHour: number;
};

export const entitlementsByIsAnonymous: Record<string, Entitlements> = {
  true: {
    maxMessagesPerHour: 10,
  },
  false: {
    maxMessagesPerHour: 10,
  },
};
