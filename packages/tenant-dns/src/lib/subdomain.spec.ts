import { suggestValidSubdomain } from './subdomain';

describe('suggestValidSubdomain', () => {
  it('should return a valid subdomain', () => {
    const name = 'mycompany';
    const subdomain = suggestValidSubdomain(name, 'test.com');
    expect(subdomain).toBe('mycompany');
    expect(subdomain?.length).toBeLessThanOrEqual(63);
    expect(subdomain).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('should handle invalid characters', () => {
    const name = 'my_company';
    const subdomain = suggestValidSubdomain(name, 'test.com');
    expect(subdomain).toBe('my-company');
    expect(subdomain?.length).toBeLessThanOrEqual(63);
    expect(subdomain).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('should handle hyphens', () => {
    const name = 'my-company';
    const subdomain = suggestValidSubdomain(name, 'test.com');
    expect(subdomain).toBe('my-company');
    expect(subdomain?.length).toBeLessThanOrEqual(63);
    expect(subdomain).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('should handle edge cases', () => {
    const name = 'my-company-';
    const subdomain = suggestValidSubdomain(name, 'test.com');
    expect(subdomain).toBe('my-company');
    expect(subdomain?.length).toBeLessThanOrEqual(63);
    expect(subdomain).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('should handle long names', () => {
    const name = 'a'.repeat(100);
    const subdomain = suggestValidSubdomain(name, 'test.com');
    expect(subdomain).toBe('a'.repeat(63));
    expect(subdomain?.length).toBeLessThanOrEqual(63);
    expect(subdomain).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  })

  it('should handle non ascii', () => {
    const name = 'my_company_👍';
    const subdomain = suggestValidSubdomain(name, 'test.com');
    expect(subdomain).toBe('my-company');
    expect(subdomain?.length).toBeLessThanOrEqual(63);
    expect(subdomain).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  })

});
