import mongoose from 'mongoose';
import { settings } from '../config.js';
import { createIndexes } from '../database/store.js';

const connection = await mongoose.createConnection(settings.MONGODB_URI, { autoIndex: false }).asPromise();
try {
  await createIndexes(connection);
  console.info('Indeksy v002 gotowe: sesje, widoki, wyszukiwania, sekwencje, zadania, adnotacje i agent.');
} finally {
  await connection.close();
}
