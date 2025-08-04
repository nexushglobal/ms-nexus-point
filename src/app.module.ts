import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './config/database.config';
import { PointModule } from './point/point.module';
import { WeeklyVolumeModule } from './weekly-volume/weekly-volume.module';
import { CommonModule } from './common/common.module';
import { MessagingModule } from './messaging/messaging.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => databaseConfig,
    }),
    PointModule,
    WeeklyVolumeModule,
    CommonModule,
    MessagingModule.register(),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
