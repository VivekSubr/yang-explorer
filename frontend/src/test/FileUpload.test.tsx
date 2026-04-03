import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileUpload from '../components/FileUpload';
import type { YangInput } from '../components/FileUpload';

describe('FileUpload', () => {
  let onUpload: ReturnType<typeof vi.fn<(input: YangInput) => void>>;

  beforeEach(() => {
    onUpload = vi.fn<(input: YangInput) => void>();
  });

  // --- Tab rendering ---

  it('renders all three input mode tabs', () => {
    render(<FileUpload onUpload={onUpload} isLoading={false} />);

    expect(screen.getByText(/Upload \/ Drop/)).toBeInTheDocument();
    expect(screen.getByText(/Paste Content/)).toBeInTheDocument();
    expect(screen.getByText(/Server File Path/)).toBeInTheDocument();
  });

  it('shows upload mode by default', () => {
    render(<FileUpload onUpload={onUpload} isLoading={false} />);

    expect(screen.getByText('Drag & drop a .yang file here')).toBeInTheDocument();
    expect(screen.getByText('Browse Files')).toBeInTheDocument();
  });

  // --- Tab switching ---

  it('switches to paste mode when Paste Content tab is clicked', async () => {
    render(<FileUpload onUpload={onUpload} isLoading={false} />);

    await userEvent.click(screen.getByText(/Paste Content/));

    expect(screen.getByPlaceholderText(/Paste your YANG module/)).toBeInTheDocument();
    expect(screen.getByText('Parse YANG')).toBeInTheDocument();
  });

  it('switches to filepath mode when Server File Path tab is clicked', async () => {
    render(<FileUpload onUpload={onUpload} isLoading={false} />);

    await userEvent.click(screen.getByText(/Server File Path/));

    expect(screen.getByPlaceholderText(/\.yang/)).toBeInTheDocument();
    expect(screen.getByText('Load File')).toBeInTheDocument();
  });

  it('switches back to upload mode', async () => {
    render(<FileUpload onUpload={onUpload} isLoading={false} />);

    await userEvent.click(screen.getByText(/Paste Content/));
    await userEvent.click(screen.getByText(/Upload \/ Drop/));

    expect(screen.getByText('Drag & drop a .yang file here')).toBeInTheDocument();
  });

  // --- Upload mode ---

  it('calls onUpload with file input on file selection', async () => {
    render(<FileUpload onUpload={onUpload} isLoading={false} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['module test {}'], 'test.yang', { type: 'text/plain' });

    await userEvent.upload(fileInput, file);

    expect(onUpload).toHaveBeenCalledTimes(1);
    const call = onUpload.mock.calls[0][0] as YangInput;
    expect(call.type).toBe('file');
    if (call.type === 'file') {
      expect(call.file.name).toBe('test.yang');
    }
  });

  it('handles drag and drop of .yang file', () => {
    render(<FileUpload onUpload={onUpload} isLoading={false} />);

    const dropZone = screen.getByText('Drag & drop a .yang file here').closest('.file-upload')!;
    const file = new File(['module test {}'], 'test.yang', { type: 'text/plain' });

    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file],
        getData: () => '',
      },
    });

    expect(onUpload).toHaveBeenCalledTimes(1);
    const call = onUpload.mock.calls[0][0] as YangInput;
    expect(call.type).toBe('file');
  });

  it('rejects non-.yang files on drag and drop', () => {
    render(<FileUpload onUpload={onUpload} isLoading={false} />);

    const dropZone = screen.getByText('Drag & drop a .yang file here').closest('.file-upload')!;
    const file = new File(['some content'], 'readme.txt', { type: 'text/plain' });

    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file],
        getData: () => '',
      },
    });

    expect(onUpload).not.toHaveBeenCalled();
  });

  // --- Paste mode ---

  it('calls onUpload with content input on paste submit', async () => {
    render(<FileUpload onUpload={onUpload} isLoading={false} />);

    await userEvent.click(screen.getByText(/Paste Content/));

    const textarea = screen.getByPlaceholderText(/Paste your YANG module/);
    await userEvent.type(textarea, 'module test-paste {{ }}');

    await userEvent.click(screen.getByText('Parse YANG'));

    expect(onUpload).toHaveBeenCalledTimes(1);
    const call = onUpload.mock.calls[0][0] as YangInput;
    expect(call.type).toBe('content');
    if (call.type === 'content') {
      expect(call.content).toContain('module test-paste');
      expect(call.filename).toBe('input.yang');
    }
  });

  it('uses custom filename when provided in paste mode', async () => {
    render(<FileUpload onUpload={onUpload} isLoading={false} />);

    await userEvent.click(screen.getByText(/Paste Content/));

    const filenameInput = screen.getByPlaceholderText(/my-module\.yang/);
    await userEvent.type(filenameInput, 'custom.yang');

    const textarea = screen.getByPlaceholderText(/Paste your YANG module/);
    await userEvent.type(textarea, 'module custom {{ }}');

    await userEvent.click(screen.getByText('Parse YANG'));

    const call = onUpload.mock.calls[0][0] as YangInput;
    if (call.type === 'content') {
      expect(call.filename).toBe('custom.yang');
    }
  });

  it('disables Parse YANG button when textarea is empty', async () => {
    render(<FileUpload onUpload={onUpload} isLoading={false} />);

    await userEvent.click(screen.getByText(/Paste Content/));

    const button = screen.getByText('Parse YANG');
    expect(button).toBeDisabled();
  });

  // --- Filepath mode ---

  it('calls onUpload with filepath input on submit', async () => {
    render(<FileUpload onUpload={onUpload} isLoading={false} />);

    await userEvent.click(screen.getByText(/Server File Path/));

    const input = screen.getByPlaceholderText(/\.yang/);
    await userEvent.type(input, 'C:\\models\\test.yang');

    await userEvent.click(screen.getByText('Load File'));

    expect(onUpload).toHaveBeenCalledTimes(1);
    const call = onUpload.mock.calls[0][0] as YangInput;
    expect(call.type).toBe('filepath');
    if (call.type === 'filepath') {
      expect(call.filepath).toBe('C:\\models\\test.yang');
    }
  });

  it('submits filepath on Enter key', async () => {
    render(<FileUpload onUpload={onUpload} isLoading={false} />);

    await userEvent.click(screen.getByText(/Server File Path/));

    const input = screen.getByPlaceholderText(/\.yang/);
    await userEvent.type(input, '/opt/yang/test.yang{enter}');

    expect(onUpload).toHaveBeenCalledTimes(1);
    const call = onUpload.mock.calls[0][0] as YangInput;
    if (call.type === 'filepath') {
      expect(call.filepath).toBe('/opt/yang/test.yang');
    }
  });

  it('disables Load File button when filepath is empty', async () => {
    render(<FileUpload onUpload={onUpload} isLoading={false} />);

    await userEvent.click(screen.getByText(/Server File Path/));

    const button = screen.getByText('Load File');
    expect(button).toBeDisabled();
  });

  // --- Loading state ---

  it('disables tabs when loading', () => {
    render(<FileUpload onUpload={onUpload} isLoading={true} />);

    const tabs = screen.getAllByRole('button');
    tabs.forEach((tab) => {
      if (tab.classList.contains('mode-tab')) {
        expect(tab).toBeDisabled();
      }
    });
  });

  it('shows loading text in upload mode', () => {
    render(<FileUpload onUpload={onUpload} isLoading={true} />);

    expect(screen.getByText('Parsing YANG file...')).toBeInTheDocument();
  });
});
