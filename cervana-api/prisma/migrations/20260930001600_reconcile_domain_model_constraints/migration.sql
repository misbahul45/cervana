-- DropForeignKey
ALTER TABLE "BehavioralSignals" DROP CONSTRAINT "BehavioralSignals_userId_fkey";

-- DropForeignKey
ALTER TABLE "DecisionTrace" DROP CONSTRAINT "DecisionTrace_userId_fkey";

-- DropForeignKey
ALTER TABLE "Episode" DROP CONSTRAINT "Episode_userId_fkey";

-- DropForeignKey
ALTER TABLE "EpisodicMemory" DROP CONSTRAINT "EpisodicMemory_userId_fkey";

-- DropForeignKey
ALTER TABLE "ExperimentRun" DROP CONSTRAINT "ExperimentRun_experimentId_fkey";

-- DropForeignKey
ALTER TABLE "InteractionEvaluation" DROP CONSTRAINT "InteractionEvaluation_episodeId_fkey";

-- DropForeignKey
ALTER TABLE "LearnerGoal" DROP CONSTRAINT "LearnerGoal_topicId_fkey";

-- DropForeignKey
ALTER TABLE "LearnerGoal" DROP CONSTRAINT "LearnerGoal_userId_fkey";

-- DropForeignKey
ALTER TABLE "LearningEvent" DROP CONSTRAINT "LearningEvent_userId_fkey";

-- DropForeignKey
ALTER TABLE "LearningPreference" DROP CONSTRAINT "LearningPreference_userId_fkey";

-- DropForeignKey
ALTER TABLE "Misconception" DROP CONSTRAINT "Misconception_userId_fkey";

-- DropForeignKey
ALTER TABLE "ProceduralMemory" DROP CONSTRAINT "ProceduralMemory_userId_fkey";

-- DropForeignKey
ALTER TABLE "SemanticLearnerMemory" DROP CONSTRAINT "SemanticLearnerMemory_userId_fkey";

-- DropForeignKey
ALTER TABLE "StepMasteryRecord" DROP CONSTRAINT "StepMasteryRecord_stepId_fkey";

-- DropForeignKey
ALTER TABLE "StepMasteryRecord" DROP CONSTRAINT "StepMasteryRecord_userId_fkey";

-- DropForeignKey
ALTER TABLE "TeacherOverride" DROP CONSTRAINT "TeacherOverride_targetUserId_fkey";

-- DropForeignKey
ALTER TABLE "TeacherOverride" DROP CONSTRAINT "TeacherOverride_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "TopicMasteryRecord" DROP CONSTRAINT "TopicMasteryRecord_topicId_fkey";

-- DropForeignKey
ALTER TABLE "TopicMasteryRecord" DROP CONSTRAINT "TopicMasteryRecord_userId_fkey";

-- CreateIndex
CREATE INDEX "DecisionTrace_traceId_idx" ON "DecisionTrace"("traceId");

-- AddForeignKey
ALTER TABLE "LearnerGoal" ADD CONSTRAINT "LearnerGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerGoal" ADD CONSTRAINT "LearnerGoal_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicMasteryRecord" ADD CONSTRAINT "TopicMasteryRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicMasteryRecord" ADD CONSTRAINT "TopicMasteryRecord_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepMasteryRecord" ADD CONSTRAINT "StepMasteryRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepMasteryRecord" ADD CONSTRAINT "StepMasteryRecord_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "Step"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Misconception" ADD CONSTRAINT "Misconception_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPreference" ADD CONSTRAINT "LearningPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehavioralSignals" ADD CONSTRAINT "BehavioralSignals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodicMemory" ADD CONSTRAINT "EpisodicMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemanticLearnerMemory" ADD CONSTRAINT "SemanticLearnerMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProceduralMemory" ADD CONSTRAINT "ProceduralMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningEvent" ADD CONSTRAINT "LearningEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionEvaluation" ADD CONSTRAINT "InteractionEvaluation_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentRun" ADD CONSTRAINT "ExperimentRun_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionTrace" ADD CONSTRAINT "DecisionTrace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherOverride" ADD CONSTRAINT "TeacherOverride_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherOverride" ADD CONSTRAINT "TeacherOverride_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
