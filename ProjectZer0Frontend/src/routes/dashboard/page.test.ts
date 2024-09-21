// ProjectZer0Frontend/src/routes/dashboard/page.test.ts
import { render } from '@testing-library/svelte';
import Dashboard from './+page.svelte';
import { describe, it, expect } from 'vitest';

describe('Dashboard Page', () => {
  it('renders the dashboard', () => {
    const { getByText } = render(Dashboard);
    expect(getByText('Dashboard')).toBeTruthy();
  });
});