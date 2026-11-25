import 'dotenv/config';
import {jsonStore,storeLocation} from '../store/json-store.mjs';
await jsonStore.init();
console.log('JSON storage ready:',storeLocation());
