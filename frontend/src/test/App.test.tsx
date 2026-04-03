import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

// Mock schema response
const mockSchema = {
  module: 'test-module',
  namespace: 'http://test.com',
  prefix: 'tm',
  description: 'A test module',
  revision: '2024-01-01',
  children: [
    {
      name: 'config',
      kind: 'container',
      path: '/test-module/config',
      children: [],
    },
  ],
};

const mockCompliance = {
  compliant: true,
  score: 85,
  summary: 'Mostly compliant',
  checks: [
    { rule: 'naming', category: 'naming', status: 'pass', message: 'Good naming' },
  ],
};

const mockLint = {
  score: 90,
  summary: 'Minor issues',
  issues: [
    {
      rule: 'test-rule',
      guideline: 1,
      severity: 'warning',
      message: 'Test warning',
    },
  ],
};

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

function mockFetchSuccess(): FetchMock {
  return vi.fn<typeof fetch>((url: RequestInfo | URL) => {
    const urlStr = String(url);
    if (urlStr.includes('/parse')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockSchema),
      } as Response);
    }
    if (urlStr.includes('/sonic-compliance')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockCompliance),
      } as Response);
    }
    if (urlStr.includes('/sonic-lint')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockLint),
      } as Response);
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as Response);
  });
}

describe('App', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('renders the header', () => {
    render(<App />);
    expect(screen.getByText('YANG Explorer')).toBeInTheDocument();
    expect(screen.getByText('Interactive YANG Schema Viewer')).toBeInTheDocument();
  });

  it('renders the file upload component with all tabs', () => {
    render(<App />);
    expect(screen.getByText(/Upload \/ Drop/)).toBeInTheDocument();
    expect(screen.getByText(/Paste Content/)).toBeInTheDocument();
    expect(screen.getByText(/Server File Path/)).toBeInTheDocument();
  });

  it('does not show schema viewer initially', () => {
    render(<App />);
    expect(screen.queryByText('Schema Explorer')).not.toBeInTheDocument();
  });

  it('shows schema after successful file upload', async () => {
    globalThis.fetch = mockFetchSuccess();

    render(<App />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['module test {}'], 'test.yang', { type: 'text/plain' });
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByText('test-module')).toBeInTheDocument();
    });

    expect(screen.getByText('Schema Explorer')).toBeInTheDocument();
    expect(screen.getByText('SONiC Compliance')).toBeInTheDocument();
    expect(screen.getByText('Linter')).toBeInTheDocument();
  });

  it('shows source banner after upload', async () => {
    globalThis.fetch = mockFetchSuccess();

    render(<App />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['module test {}'], 'my-module.yang', { type: 'text/plain' });
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByText('my-module.yang')).toBeInTheDocument();
    });
  });

  it('sends JSON body for paste content input', async () => {
    const fetchMock = mockFetchSuccess();
    globalThis.fetch = fetchMock;

    render(<App />);

    await userEvent.click(screen.getByText(/Paste Content/));

    const textarea = screen.getByPlaceholderText(/Paste your YANG module/);
    await userEvent.type(textarea, 'module test {{ }}');
    await userEvent.click(screen.getByText('Parse YANG'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    // Verify JSON Content-Type was sent for the parse request
    const parseCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/parse'));
    expect(parseCall).toBeDefined();
    const opts = parseCall![1] as RequestInit;
    expect(opts.headers).toBeDefined();
    const headers = opts.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(opts.body as string);
    expect(body.content).toContain('module test');
    expect(body.filename).toBe('input.yang');
  });

  it('sends JSON body for filepath input', async () => {
    const fetchMock = mockFetchSuccess();
    globalThis.fetch = fetchMock;

    render(<App />);

    await userEvent.click(screen.getByText(/Server File Path/));

    const input = screen.getByPlaceholderText(/\.yang/);
    await userEvent.type(input, 'C:\\test\\my.yang');
    await userEvent.click(screen.getByText('Load File'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const parseCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/parse'));
    const opts = parseCall![1] as RequestInit;
    const body = JSON.parse(opts.body as string);
    expect(body.filepath).toBe('C:\\test\\my.yang');
  });

  it('sends FormData for file upload', async () => {
    const fetchMock = mockFetchSuccess();
    globalThis.fetch = fetchMock;

    render(<App />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['module test {}'], 'test.yang', { type: 'text/plain' });
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const parseCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/parse'));
    const opts = parseCall![1] as RequestInit;
    expect(opts.body).toBeInstanceOf(FormData);
  });

  it('shows error banner on failed parse', async () => {
    globalThis.fetch = vi.fn<typeof fetch>(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'Parse failed: bad syntax' }),
      } as Response)
    );

    render(<App />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['bad'], 'test.yang', { type: 'text/plain' });
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByText('Parse failed: bad syntax')).toBeInTheDocument();
    });
  });

  it('shows error banner on network error', async () => {
    globalThis.fetch = vi.fn<typeof fetch>(() =>
      Promise.reject(new Error('Network failure'))
    );

    render(<App />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'test.yang', { type: 'text/plain' });
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByText('Network failure')).toBeInTheDocument();
    });
  });

  it('shows compliance score badge', async () => {
    globalThis.fetch = mockFetchSuccess();

    render(<App />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['module test {}'], 'test.yang', { type: 'text/plain' });
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByText('85%')).toBeInTheDocument();
    });
  });

  it('shows lint issue count badge', async () => {
    globalThis.fetch = mockFetchSuccess();

    render(<App />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['module test {}'], 'test.yang', { type: 'text/plain' });
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      // 1 lint issue
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  it('switches tabs between schema, compliance, and lint', async () => {
    globalThis.fetch = mockFetchSuccess();

    render(<App />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['module test {}'], 'test.yang', { type: 'text/plain' });
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByText('test-module')).toBeInTheDocument();
    });

    // Switch to compliance
    await userEvent.click(screen.getByText('SONiC Compliance'));
    expect(screen.getByText('Mostly compliant')).toBeInTheDocument();

    // Switch to lint
    await userEvent.click(screen.getByText('Linter'));
    expect(screen.getByText('Test warning')).toBeInTheDocument();

    // Switch back to schema
    await userEvent.click(screen.getByText('Schema Explorer'));
    expect(screen.getByText('test-module')).toBeInTheDocument();
  });
});
