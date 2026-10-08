import { Module } from "@nestjs/common";
import { DailyLogsModule } from "./daily-logs/daily-logs.module";
import { StreaksModule } from "./streaks/streaks.module";
import { LeaderboardsModule } from "./leaderboards/leaderboards.module";
import { RouterModule } from "@nestjs/core";
import { ThemeModule } from "./themes/themes.module";
import { BadgeIssuanceModule } from "./badges/badge-issuance.module";
import { LevelModule } from "./level/level-calculation.module";

@Module({
    imports:[
        DailyLogsModule, 
        StreaksModule, 
        LeaderboardsModule,
        ThemeModule,
        BadgeIssuanceModule,
        LevelModule,
        RouterModule.register([
            {
                path:'gamify',
                children:[
                    {path:'', module: DailyLogsModule},
                    {path:'', module: StreaksModule},
                    {path:'', module: LeaderboardsModule},
                    {path:'', module: ThemeModule},
                    {path:'', module: BadgeIssuanceModule},
                    {path:'', module: LevelModule},
                ]
            }
        ])
    ],
    exports:[DailyLogsModule, StreaksModule, LeaderboardsModule, ThemeModule, BadgeIssuanceModule, LevelModule]
})

export class GamifyModule{}