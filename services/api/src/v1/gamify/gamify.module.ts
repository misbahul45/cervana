import { Module } from "@nestjs/common";
import { DailyLogsModule } from "./daily-logs/daily-logs.module";
import { StreaksModule } from "./streaks/streaks.module";
import { LeaderboardsModule } from "./leaderboards/leaderboards.module";
import { RouterModule } from "@nestjs/core";
import { ThemeModule } from "./themes/themes.module";

@Module({
    imports:[
        DailyLogsModule, 
        StreaksModule, 
        LeaderboardsModule,
        ThemeModule,
        RouterModule.register([
            {
                path:'gamify',
                children:[
                    {path:'', module: DailyLogsModule},
                    {path:'', module: StreaksModule},
                    {path:'', module: LeaderboardsModule},
                    {path:'', module: ThemeModule},
                ]
            }
        ])
    ],
    exports:[DailyLogsModule, StreaksModule, LeaderboardsModule, ThemeModule]
})

export class GamifyModule{}