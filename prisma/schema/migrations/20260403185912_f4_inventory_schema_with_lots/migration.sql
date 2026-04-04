-- CreateEnum
CREATE TYPE "TrackingType" AS ENUM ('NONE', 'LOT', 'SERIAL');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('INTERNAL', 'SUPPLIER', 'CUSTOMER', 'SCRAPPING', 'TRANSIT');

-- CreateEnum
CREATE TYPE "StockMoveState" AS ENUM ('DRAFT', 'CONFIRMED', 'DONE', 'CANCELLED');

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "sales_order_id" UUID;

-- AlterTable
ALTER TABLE "supplier_invoices" ADD COLUMN     "purchase_order_id" UUID;

-- CreateTable
CREATE TABLE "product_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units_of_measure" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_of_measure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "category_id" UUID,
    "unit_of_measure_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "barcode" TEXT,
    "tracking_type" "TrackingType" NOT NULL DEFAULT 'NONE',
    "cost_price" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "sale_price" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "inventory_account_id" UUID,
    "cogs_account_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "warehouse_id" UUID,
    "parent_id" UUID,
    "location_type" "LocationType" NOT NULL,
    "name" TEXT NOT NULL,
    "full_path" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "supplier_id" UUID,
    "lot_number" TEXT NOT NULL,
    "manufacturing_date" DATE,
    "expiration_date" DATE,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_quants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "lot_id" UUID,
    "quantity" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_quants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_moves" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "from_location_id" UUID NOT NULL,
    "to_location_id" UUID NOT NULL,
    "state" "StockMoveState" NOT NULL DEFAULT 'DRAFT',
    "scheduled_date" DATE NOT NULL,
    "done_date" DATE,
    "qty_demand" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "qty_done" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "reference" TEXT,
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_moves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_move_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "stock_move_id" UUID NOT NULL,
    "lot_id" UUID,
    "quantity" DECIMAL(12,4) NOT NULL,
    "done_qty" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_move_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reorder_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "min_qty" DECIMAL(12,4) NOT NULL,
    "max_qty" DECIMAL(12,4) NOT NULL,
    "qty_multiple" DECIMAL(12,4) NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reorder_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_categories_company_id_is_active_idx" ON "product_categories"("company_id", "is_active");

-- CreateIndex
CREATE INDEX "product_categories_company_id_parent_id_idx" ON "product_categories"("company_id", "parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_company_id_name_key" ON "product_categories"("company_id", "name");

-- CreateIndex
CREATE INDEX "units_of_measure_company_id_is_active_idx" ON "units_of_measure"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "units_of_measure_company_id_symbol_key" ON "units_of_measure"("company_id", "symbol");

-- CreateIndex
CREATE INDEX "products_company_id_is_active_idx" ON "products"("company_id", "is_active");

-- CreateIndex
CREATE INDEX "products_company_id_category_id_idx" ON "products"("company_id", "category_id");

-- CreateIndex
CREATE INDEX "products_company_id_tracking_type_idx" ON "products"("company_id", "tracking_type");

-- CreateIndex
CREATE UNIQUE INDEX "products_company_id_code_key" ON "products"("company_id", "code");

-- CreateIndex
CREATE INDEX "warehouses_company_id_is_active_idx" ON "warehouses"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_company_id_code_key" ON "warehouses"("company_id", "code");

-- CreateIndex
CREATE INDEX "locations_company_id_location_type_idx" ON "locations"("company_id", "location_type");

-- CreateIndex
CREATE INDEX "locations_company_id_warehouse_id_idx" ON "locations"("company_id", "warehouse_id");

-- CreateIndex
CREATE INDEX "locations_company_id_is_active_idx" ON "locations"("company_id", "is_active");

-- CreateIndex
CREATE INDEX "lots_company_id_product_id_idx" ON "lots"("company_id", "product_id");

-- CreateIndex
CREATE INDEX "lots_company_id_expiration_date_idx" ON "lots"("company_id", "expiration_date");

-- CreateIndex
CREATE UNIQUE INDEX "lots_company_id_product_id_lot_number_key" ON "lots"("company_id", "product_id", "lot_number");

-- CreateIndex
CREATE INDEX "stock_quants_company_id_product_id_idx" ON "stock_quants"("company_id", "product_id");

-- CreateIndex
CREATE INDEX "stock_quants_company_id_location_id_idx" ON "stock_quants"("company_id", "location_id");

-- CreateIndex
CREATE INDEX "stock_quants_company_id_lot_id_idx" ON "stock_quants"("company_id", "lot_id");

-- CreateIndex
CREATE INDEX "stock_moves_company_id_state_idx" ON "stock_moves"("company_id", "state");

-- CreateIndex
CREATE INDEX "stock_moves_company_id_product_id_idx" ON "stock_moves"("company_id", "product_id");

-- CreateIndex
CREATE INDEX "stock_moves_company_id_scheduled_date_idx" ON "stock_moves"("company_id", "scheduled_date");

-- CreateIndex
CREATE INDEX "stock_moves_company_id_reference_idx" ON "stock_moves"("company_id", "reference");

-- CreateIndex
CREATE INDEX "stock_move_lines_company_id_stock_move_id_idx" ON "stock_move_lines"("company_id", "stock_move_id");

-- CreateIndex
CREATE INDEX "stock_move_lines_company_id_lot_id_idx" ON "stock_move_lines"("company_id", "lot_id");

-- CreateIndex
CREATE INDEX "reorder_rules_company_id_is_active_idx" ON "reorder_rules"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "reorder_rules_company_id_product_id_location_id_key" ON "reorder_rules"("company_id", "product_id", "location_id");

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units_of_measure" ADD CONSTRAINT "units_of_measure_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_unit_of_measure_id_fkey" FOREIGN KEY ("unit_of_measure_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_quants" ADD CONSTRAINT "stock_quants_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_quants" ADD CONSTRAINT "stock_quants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_quants" ADD CONSTRAINT "stock_quants_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_quants" ADD CONSTRAINT "stock_quants_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_move_lines" ADD CONSTRAINT "stock_move_lines_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_move_lines" ADD CONSTRAINT "stock_move_lines_stock_move_id_fkey" FOREIGN KEY ("stock_move_id") REFERENCES "stock_moves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_move_lines" ADD CONSTRAINT "stock_move_lines_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reorder_rules" ADD CONSTRAINT "reorder_rules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reorder_rules" ADD CONSTRAINT "reorder_rules_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reorder_rules" ADD CONSTRAINT "reorder_rules_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
