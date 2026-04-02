-- AlterTable
ALTER TABLE "journal_entries" ADD COLUMN     "cancelled_by_id" UUID;

-- CreateTable
CREATE TABLE "journal_sequences" (
    "company_id" UUID NOT NULL,
    "journal_id" UUID NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_sequences_pkey" PRIMARY KEY ("company_id","journal_id")
);

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_sequences" ADD CONSTRAINT "journal_sequences_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_sequences" ADD CONSTRAINT "journal_sequences_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
