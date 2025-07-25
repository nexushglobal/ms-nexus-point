import { DynamicModule, Global, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MessagingService } from './messaging.service';
import { envs } from 'src/config/envs';
import { POINT_SERVICE } from 'src/config/services';

@Global()
@Module({
  exports: [],
  providers: [],
})
export class MessagingModule {
  static register(): DynamicModule {
    return {
      module: MessagingModule,
      imports: [
        ClientsModule.register([
          {
            name: POINT_SERVICE,
            transport: Transport.NATS,
            options: {
              servers: [envs.NATS_SERVERS],
              queue: 'ms-nexus-point-queue',
              reconnect: true,
              maxReconnectAttempts: -1,
              reconnectTimeWait: 2000,
              waitOnFirstConnect: true,
            },
          },
        ]),
      ],
      exports: [MessagingService],
      providers: [MessagingService],
    };
  }
}
