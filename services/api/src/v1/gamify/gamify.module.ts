import { Module } from "@nestjs/common";
import { DailyLogsModule } from "./daily-logs/daily-logs.module";
import { StreaksModule } from "./streaks/streaks.module";
import { LeaderboardsModule } from "./leaderboards/leaderboards.module";
import { RouterModule } from "@nestjs/core";
import { ThemeModule } from "./themes/themes.module";
import { AchievementsModule } from "./achievements/achievements.module";
import { GamifyMeModule } from "./me/gamify-me.module";
import { RewardsModule } from "./rewards/rewards.module";

@Module({
    imports:[
        DailyLogsModule, 
        StreaksModule, 
        LeaderboardsModule,
        ThemeModule,
        AchievementsModule,
        GamifyMeModule,
        RewardsModule,
        RouterModule.register([
            {
                path:'gamify',
                children:[
                    {path:'', module: DailyLogsModule},
                    {path:'', module: StreaksModule},
                    {path:'', module: LeaderboardsModule},
                    {path:'', module: ThemeModule},
                    {path:'', module: AchievementsModule},
                    {path:'', module: GamifyMeModule},
                    {path:'', module: RewardsModule},
                ]
            }
        ])
    ],
    exports:[DailyLogsModule, StreaksModule, LeaderboardsModule, ThemeModule, AchievementsModule, GamifyMeModule, RewardsModule]
})

export class GamifyModule{}