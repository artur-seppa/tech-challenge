-- CreateIndex
CREATE INDEX "transactions_status_updatedAt_idx" ON "transactions"("status", "updatedAt");
