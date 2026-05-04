/**
 * @ton/core и часть их зависимостей используют Node Buffer.
 * В браузере задаём globalThis.Buffer до любого импорта @ton/core.
 */
import { Buffer } from 'buffer';

const g = globalThis as typeof globalThis & { Buffer?: typeof Buffer };

if (typeof g.Buffer === 'undefined') {
  g.Buffer = Buffer;
}
