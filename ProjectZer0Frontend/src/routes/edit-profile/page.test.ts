// ProjectZer0Frontend/src/routes/edit-profile/page.test.ts
import { render } from '@testing-library/svelte';
import EditProfile from './+page.svelte';
import { describe, it, expect } from 'vitest';

describe('Edit Profile Page', () => {
  it('renders the edit profile page', () => {
    const { getByText } = render(EditProfile);
    expect(getByText('Edit Profile')).toBeTruthy();
  });
});