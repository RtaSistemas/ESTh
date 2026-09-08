import "@testing-library/jest-dom/vitest";
// jsdom não implementa IndexedDB — polyfill pra assetStorage.ts funcionar
// nos testes exatamente como no navegador real.
import "fake-indexeddb/auto";
