-- DropIndex
DROP INDEX "User_whatsappJid_key";

-- DropIndex
DROP INDEX "User_whatsappNumber_key";

-- CreateIndex
CREATE INDEX "User_whatsappNumber_idx" ON "User"("whatsappNumber");

-- CreateIndex
CREATE INDEX "User_whatsappJid_idx" ON "User"("whatsappJid");
