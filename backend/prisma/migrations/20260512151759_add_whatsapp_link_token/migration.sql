/*
  Warnings:

  - A unique constraint covering the columns `[whatsappJid]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "whatsappJid" TEXT;

-- CreateTable
CREATE TABLE "WhatsappLinkToken" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappLinkToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappLinkToken_token_key" ON "WhatsappLinkToken"("token");

-- CreateIndex
CREATE INDEX "WhatsappLinkToken_tenantId_idx" ON "WhatsappLinkToken"("tenantId");

-- CreateIndex
CREATE INDEX "WhatsappLinkToken_userId_idx" ON "WhatsappLinkToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_whatsappJid_key" ON "User"("whatsappJid");

-- AddForeignKey
ALTER TABLE "WhatsappLinkToken" ADD CONSTRAINT "WhatsappLinkToken_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappLinkToken" ADD CONSTRAINT "WhatsappLinkToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
