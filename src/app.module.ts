import { Module } from '@nestjs/common';
import { MigrationModule } from './migration/migration.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './config/database.config';
import { PointModule } from './point/point.module';
import { WeeklyVolumeModule } from './weekly-volume/weekly-volume.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => databaseConfig,
    }),
    MigrationModule,
    PointModule,
    WeeklyVolumeModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
