-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('boy', 'girl');

-- CreateEnum
CREATE TYPE "ClothingCategory" AS ENUM ('shirt', 'trousers', 'skirt', 'dress', 'accessories');

-- CreateEnum
CREATE TYPE "Season" AS ENUM ('summer', 'winter', 'all_season');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'child');

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "familyCode" TEXT NOT NULL,
    "adminCredentialHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Child" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "childCodeDigest" TEXT NOT NULL,
    "credentialHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClothingItem" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ClothingCategory" NOT NULL,
    "season" "Season" NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "lastStatusChangeAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClothingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrentSelection" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurrentSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrentSelectionItem" (
    "selectionId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "clothingItemId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurrentSelectionItem_pkey" PRIMARY KEY ("selectionId","clothingItemId")
);

-- CreateTable
CREATE TABLE "Outfit" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Outfit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutfitItem" (
    "outfitId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "clothingItemId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutfitItem_pkey" PRIMARY KEY ("outfitId","clothingItemId")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "familyId" TEXT NOT NULL,
    "childId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginThrottle" (
    "key" TEXT NOT NULL,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "firstFailedAt" TIMESTAMP(3) NOT NULL,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginThrottle_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Family_familyCode_key" ON "Family"("familyCode");

-- CreateIndex
CREATE INDEX "Child_familyId_idx" ON "Child"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "Child_familyId_nameNormalized_key" ON "Child"("familyId", "nameNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "Child_familyId_childCodeDigest_key" ON "Child"("familyId", "childCodeDigest");

-- CreateIndex
CREATE UNIQUE INDEX "Child_id_familyId_key" ON "Child"("id", "familyId");

-- CreateIndex
CREATE INDEX "ClothingItem_childId_idx" ON "ClothingItem"("childId");

-- CreateIndex
CREATE INDEX "ClothingItem_childId_isAvailable_idx" ON "ClothingItem"("childId", "isAvailable");

-- CreateIndex
CREATE INDEX "ClothingItem_childId_category_idx" ON "ClothingItem"("childId", "category");

-- CreateIndex
CREATE INDEX "ClothingItem_childId_season_idx" ON "ClothingItem"("childId", "season");

-- CreateIndex
CREATE UNIQUE INDEX "ClothingItem_id_childId_key" ON "ClothingItem"("id", "childId");

-- CreateIndex
CREATE UNIQUE INDEX "CurrentSelection_childId_key" ON "CurrentSelection"("childId");

-- CreateIndex
CREATE UNIQUE INDEX "CurrentSelection_id_childId_key" ON "CurrentSelection"("id", "childId");

-- CreateIndex
CREATE INDEX "CurrentSelectionItem_clothingItemId_idx" ON "CurrentSelectionItem"("clothingItemId");

-- CreateIndex
CREATE INDEX "Outfit_childId_idx" ON "Outfit"("childId");

-- CreateIndex
CREATE UNIQUE INDEX "Outfit_id_childId_key" ON "Outfit"("id", "childId");

-- CreateIndex
CREATE INDEX "OutfitItem_clothingItemId_idx" ON "OutfitItem"("clothingItemId");

-- CreateIndex
CREATE INDEX "Message_familyId_createdAt_idx" ON "Message"("familyId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_childId_idx" ON "Message"("childId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_familyId_idx" ON "Session"("familyId");

-- CreateIndex
CREATE INDEX "Session_childId_idx" ON "Session"("childId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- AddForeignKey
ALTER TABLE "Child" ADD CONSTRAINT "Child_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClothingItem" ADD CONSTRAINT "ClothingItem_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrentSelection" ADD CONSTRAINT "CurrentSelection_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrentSelectionItem" ADD CONSTRAINT "CurrentSelectionItem_selectionId_childId_fkey" FOREIGN KEY ("selectionId", "childId") REFERENCES "CurrentSelection"("id", "childId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrentSelectionItem" ADD CONSTRAINT "CurrentSelectionItem_clothingItemId_childId_fkey" FOREIGN KEY ("clothingItemId", "childId") REFERENCES "ClothingItem"("id", "childId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outfit" ADD CONSTRAINT "Outfit_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutfitItem" ADD CONSTRAINT "OutfitItem_outfitId_childId_fkey" FOREIGN KEY ("outfitId", "childId") REFERENCES "Outfit"("id", "childId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutfitItem" ADD CONSTRAINT "OutfitItem_clothingItemId_childId_fkey" FOREIGN KEY ("clothingItemId", "childId") REFERENCES "ClothingItem"("id", "childId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_childId_familyId_fkey" FOREIGN KEY ("childId", "familyId") REFERENCES "Child"("id", "familyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;
