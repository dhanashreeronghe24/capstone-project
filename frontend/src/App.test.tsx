import { screen } from '@testing-library/react';
import { renderApp, resetSession } from '@/test/render-app';

describe('app shell', () => {
  it('renders the home route inside the layout and providers', async () => {
    resetSession();
    renderApp('/');

    expect(screen.getByRole('link', { name: 'Book Worm' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Recommended for You' })).toBeInTheDocument();
  });
});
