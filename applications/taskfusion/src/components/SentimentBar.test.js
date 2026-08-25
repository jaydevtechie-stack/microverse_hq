import { render, screen } from '@testing-library/react';
import SentimentBar from './SentimentBar';

// Deliberately not App.test.js's old "renders learn react link" — that
// boilerplate rendered the full <App>, which pulls in every route plus
// keycloak-js/@tiptap, several of which ship package.json "exports"
// conditions react-scripts 5's bundled Jest (v27) doesn't resolve
// correctly (see package.json's moduleNameMapper/transformIgnorePatterns
// and setupTests.js's TextEncoder polyfill for the two fixed so far).
// SentimentBar has zero dependencies beyond React itself, so it's real
// CI coverage without inheriting that whole rabbit hole.
//
// No assertions on the `background` style here: jsdom's CSS parser
// (cssstyle) doesn't reliably keep `var(--custom-property)` values in a
// shorthand like `background`, silently dropping them from the inline
// style rather than a real app bug — width (a plain numeric percent, no
// custom property involved) is the reliable thing to assert on.
describe('SentimentBar', () => {
  test('renders the label and percent text', () => {
    render(<SentimentBar label="Frustration" percent={71} />);
    expect(screen.getByText('Frustration')).toBeInTheDocument();
    expect(screen.getByText('71%')).toBeInTheDocument();
  });

  test('sets the fill bar width from the percent prop', () => {
    const { container } = render(<SentimentBar label="Trust" percent={33} />);
    const fill = container.querySelector('div[style*="width"]');
    expect(fill).toHaveStyle({ width: '33%' });
  });

  test('a different percent produces a different width', () => {
    const { container } = render(<SentimentBar label="Joy" percent={85} />);
    const fill = container.querySelector('div[style*="width"]');
    expect(fill).toHaveStyle({ width: '85%' });
  });
});
