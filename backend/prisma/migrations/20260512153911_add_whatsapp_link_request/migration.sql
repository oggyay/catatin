-- CreateEnum
CREATE TYPE "LinkRequestStatus" AS ENUM ('pending', 'confirmed', 'cancelled', 'expired');

-- CreateTable
CREATE TABLE "WhatsappLinkRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "whatsappNumber" TEXT NOT NULL,
    "status" "LinkRequestStatus" NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "confirmedJid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappLinkRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsappLinkRequest_tenantId_idx" ON "WhatsappLinkRequest"("tenantId");

-- CreateIndex
CREATE INDEX "WhatsappLinkRequest_userId_status_idx" ON "WhatsappLinkRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "WhatsappLinkRequest_whatsappNumber_status_idx" ON "WhatsappLinkRequest"("whatsappNumber", "status");

-- AddForeignKey
ALTER TABLE "WhatsappLinkRequest" ADD CONSTRAINT "WhatsappLinkRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappLinkRequest" ADD CONSTRAINT "WhatsappLinkRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
