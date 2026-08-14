import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Page from '../src/app/page';

describe('Home page', () => {
  it('renders a heading announcing the dashboard', () => {
    render(<Page />);

    expect(screen.getByRole('heading', { name: /transações/i })).toBeInTheDocument();
  });
});
