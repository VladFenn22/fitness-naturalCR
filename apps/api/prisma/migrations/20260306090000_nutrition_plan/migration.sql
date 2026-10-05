-- CU-09 · Plan nutricional con plazo determinado

-- CreateTable
CREATE TABLE "NutritionPlan" (
	"id" TEXT NOT NULL,
	"clientId" TEXT NOT NULL,
	"title" TEXT NOT NULL,
	"isActive" BOOLEAN NOT NULL DEFAULT true,
	"startDate" TIMESTAMP(3) NOT NULL,
	"endDate" TIMESTAMP(3) NOT NULL,
	"kcal" INTEGER,
	"proteinaG" INTEGER,
	"carbsG" INTEGER,
	"grasasG" INTEGER,
	"notes" TEXT,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" TIMESTAMP(3) NOT NULL,

	CONSTRAINT "NutritionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutritionMeal" (
	"id" TEXT NOT NULL,
	"planId" TEXT NOT NULL,
	"name" TEXT NOT NULL,
	"time" TEXT,
	"notes" TEXT,
	"order" INTEGER NOT NULL DEFAULT 0,

	CONSTRAINT "NutritionMeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutritionItem" (
	"id" TEXT NOT NULL,
	"mealId" TEXT NOT NULL,
	"name" TEXT NOT NULL,
	"cantidad" TEXT,
	"kcal" INTEGER,
	"proteina" DOUBLE PRECISION,
	"carbs" DOUBLE PRECISION,
	"grasas" DOUBLE PRECISION,
	"notes" TEXT,
	"order" INTEGER NOT NULL DEFAULT 0,

	CONSTRAINT "NutritionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NutritionPlan_clientId_isActive_idx" ON "NutritionPlan"("clientId", "isActive");

-- CreateIndex
CREATE INDEX "NutritionPlan_clientId_endDate_idx" ON "NutritionPlan"("clientId", "endDate");

-- CreateIndex
CREATE INDEX "NutritionMeal_planId_order_idx" ON "NutritionMeal"("planId", "order");

-- CreateIndex
CREATE INDEX "NutritionItem_mealId_order_idx" ON "NutritionItem"("mealId", "order");

-- AddForeignKey
ALTER TABLE "NutritionPlan" ADD CONSTRAINT "NutritionPlan_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutritionMeal" ADD CONSTRAINT "NutritionMeal_planId_fkey" FOREIGN KEY ("planId") REFERENCES "NutritionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutritionItem" ADD CONSTRAINT "NutritionItem_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "NutritionMeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
