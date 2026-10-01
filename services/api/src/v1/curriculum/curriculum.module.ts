import { Module } from "@nestjs/common";
import { SubtopicsModule } from "./subtopics/subtopics.module";
import { TopicsModule } from "./topics/topics.module";
import { LessonsModule } from './lessons/lessons.module';
import { StepsModule } from './steps/steps.module';
import { RouterModule } from "@nestjs/core";

@Module({
  imports: [
    TopicsModule,
    SubtopicsModule, 
    LessonsModule, 
    StepsModule, 
    RouterModule.register([
      {
        path: 'curriculum',
        children: [
          { path: '', module: TopicsModule },
          { path: '', module: SubtopicsModule },
          { path: '', module: LessonsModule },
          { path: '', module: StepsModule },
        ],
      },
    ]),
  ],
  exports: [
    TopicsModule,
    SubtopicsModule,
    LessonsModule,
    StepsModule,
  ],
})
export class curriculumModule { }