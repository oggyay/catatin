export const PLAN_LIMITS = {
  personal: {
    free: {
      maxUsers: 1,
      maxAccounts: 2,
      whatsappBot: false,
    },
    basic: {
      maxUsers: 1,
      maxAccounts: 5,
      whatsappBot: true,
    },
    pro: {
      maxUsers: 2,
      maxAccounts: 8,
      whatsappBot: true,
    },
  },
  umkm: {
    free: {
      maxUsers: 1,
      maxAccounts: 2,
      whatsappBot: false,
    },
    basic: {
      maxUsers: 3,
      maxAccounts: 5,
      whatsappBot: true,
    },
    pro: {
      maxUsers: 20,
      maxAccounts: 30,
      whatsappBot: true,
    },
  },
};

export function getPlanLimits(type, plan) {
  return PLAN_LIMITS[type]?.[plan] || PLAN_LIMITS.personal.free;
}
