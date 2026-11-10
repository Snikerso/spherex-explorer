import mongoose from 'mongoose';
import { settings } from '../config.js';
import { sessionSchema, viewSchema } from '../database/models.js';

const connection = await mongoose.createConnection(settings.MONGODB_URI, { autoIndex: false }).asPromise();
try {
  await connection.model('Session', sessionSchema).createIndexes();
  await connection.model('View', viewSchema).createIndexes();
  console.info('Indeksy v001 gotowe: sessions, views. Skrypt można uruchomić ponownie.');
} finally {
  await connection.close();
}
