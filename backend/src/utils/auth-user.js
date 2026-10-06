export function serializeAuthUser({ user, tenant }) {
  return {
    id: user.id,
    name: user.name,
    whatsappNumber: user.whatsappNumber,
    whatsappJid: user.whatsappJid,
    whatsappLinked: Boolean(user.whatsappJid),
    role: user.role,
    tenantId: user.tenantId,
    tenant: tenant
      ? {
          id: tenant.id,
          name: tenant.name,
          type: tenant.type,
          subscriptionPlan: tenant.subscriptionPlan,
          subscriptionStatus: tenant.subscriptionStatus,
          trialEndsAt: tenant.trialEndsAt,
        }
      : null,
  };
}
