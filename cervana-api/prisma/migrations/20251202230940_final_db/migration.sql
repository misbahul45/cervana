/*
  Warnings:

  - A unique constraint covering the columns `[userId,scope,categoryId,topicId,subTopicId]` on the table `LeaderboardScore` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,stepTemplateId,order]` on the table `UserStep` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "LeaderboardScore_userId_categoryId_topicId_subTopicId_key";

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardScore_userId_scope_categoryId_topicId_subTopicId_key" ON "LeaderboardScore"("userId", "scope", "categoryId", "topicId", "subTopicId");

-- CreateIndex
CREATE UNIQUE INDEX "UserStep_userId_stepTemplateId_order_key" ON "UserStep"("userId", "stepTemplateId", "order");
