// react-router v7 references TextEncoder/TextDecoder at module load time
// (via its ./dom export, see package.json's moduleNameMapper comment),
// which react-scripts 5's jsdom test environment doesn't provide as a
// global the way a browser or Node's own global scope does. Runs here
// (setupFilesAfterEnv, CRA's one non-overridable early hook) rather than
// a custom setupFiles entry — CRA doesn't allow overriding setupFiles
// without ejecting, and this file already runs before any test file's
// own imports (App.test.js -> App.js -> react-router-dom) are evaluated.
import { TextEncoder, TextDecoder } from 'node:util';
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}

// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
