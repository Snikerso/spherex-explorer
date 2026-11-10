import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller.js';
import { settings } from './config.js';
import { sessionSchema, viewSchema } from './database/models.js';
import { OriginGuard, SessionGuard } from './http.js';
import { SessionsService } from './modules/sessions/sessions.service.js';
import { WorkspaceService } from './modules/workspace/workspace.service.js';

@Module({
  imports: [
    MongooseModule.forRoot(settings.MONGODB_URI, { autoIndex: false, serverSelectionTimeoutMS: 5000, retryAttempts: 1, maxPoolSize: 10, minPoolSize: 0 }),
    MongooseModule.forFeature([{ name: 'Session', schema: sessionSchema }, { name: 'View', schema: viewSchema }]),
  ],
  controllers: [AppController],
  providers: [SessionsService, WorkspaceService, SessionGuard, OriginGuard],
})
export class AppModule {}
