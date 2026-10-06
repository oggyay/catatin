CREATE TYPE "TransferDirection" AS ENUM ('out', 'in');

ALTER TABLE "Transaction"
ADD COLUMN "transferGroupId" TEXT,
ADD COLUMN "transferDirection" "TransferDirection";

CREATE INDEX "Transaction_transferGroupId_idx" ON "Transaction"("transferGroupId");
