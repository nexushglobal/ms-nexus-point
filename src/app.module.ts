import { Module } from '@nestjs/common';
import { MigrationModule } from './migration/migration.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './config/database.config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => databaseConfig,
    }),
    MigrationModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
