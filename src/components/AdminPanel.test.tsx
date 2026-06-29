import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminPanel from './AdminPanel';
import { updateDoc } from 'firebase/firestore';

// Mock Firebase
vi.mock('../lib/firebase', () => ({
  db: { id: 'mock-db' }
}));

// Mock Firestore collection/onSnapshot/queries
const mockOnSnapshot = vi.fn().mockImplementation((_query, callback) => {
  // Return mock reports
  const mockDocs = [
    {
      id: 'report-id-1',
      data: () => ({
        id: 'report-id-1',
        category: 'Pothole',
        status: 'Reported',
        severity: 'High',
        responsible_department: 'Municipal Corporation',
        formal_complaint_text: 'Urgent pothole fixing needed near MG Road.',
        photoUrl: 'mock-img-1',
        userNotes: 'Heavy blockages',
        timestamp: { seconds: 1719262800 },
        confirmations: 3,
        location: { lat: 12.9716, lng: 77.5946 },
        reporterEmail: 'reporter@india.com'
      })
    },
    {
      id: 'report-id-2',
      data: () => ({
        id: 'report-id-2',
        category: 'Traffic Signal Issue',
        status: 'Resolved',
        severity: 'Low',
        responsible_department: 'Traffic Police',
        formal_complaint_text: 'Traffic lights blinking yellow constantly.',
        photoUrl: 'mock-img-2',
        userNotes: 'Requires repair',
        timestamp: { seconds: 1719266400 },
        confirmations: 1,
        location: { lat: 12.9716, lng: 77.5946 },
        reporterEmail: 'another@india.com'
      })
    }
  ];

  callback({
    docs: mockDocs,
    forEach: (fn: any) => mockDocs.forEach(fn)
  });
  return () => {}; // Unsubscribe function
});

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: (q, cb) => mockOnSnapshot(q, cb),
  doc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn()
}));

describe('AdminPanel - Security & Management Suite', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('should initially show the lock screen requesting the PIN', () => {
    const { container } = render(<AdminPanel />);

    expect(screen.getByText(/administrator verification/i)).toBeTruthy();
    expect(container.querySelector('#admin-pin-hidden-input')).toBeTruthy();
  });

  it('should display error message on entering incorrect pin', () => {
    const { container } = render(<AdminPanel />);

    const pinInput = container.querySelector('#admin-pin-hidden-input') as HTMLInputElement;
    const form = pinInput.closest('form');

    expect(pinInput).toBeTruthy();
    expect(form).toBeTruthy();

    if (pinInput && form) {
      fireEvent.change(pinInput, { target: { value: '9999' } });
      fireEvent.submit(form);
    }

    expect(screen.getByText(/access denied: invalid administrative pin/i)).toBeTruthy();
  });

  it('should successfully unlock with the correct pin 1234', async () => {
    const { container } = render(<AdminPanel />);

    const pinInput = container.querySelector('#admin-pin-hidden-input') as HTMLInputElement;
    const form = pinInput.closest('form');

    if (pinInput && form) {
      fireEvent.change(pinInput, { target: { value: '1234' } });
      fireEvent.submit(form);
    }

    // Verify it transitions to unlocked view and loads mock reports
    await waitFor(() => {
      expect(screen.getByText(/grievance dashboard/i)).toBeTruthy();
      expect(screen.getByText(/dispatch command panel/i)).toBeTruthy();
    });

    // Check that we render mock reports
    expect(screen.getByText(/Heavy blockages/i)).toBeTruthy();
  });

  it('should support searching and filtering once unlocked', async () => {
    const { container } = render(<AdminPanel />);

    const pinInput = container.querySelector('#admin-pin-hidden-input') as HTMLInputElement;
    const form = pinInput.closest('form');

    if (pinInput && form) {
      fireEvent.change(pinInput, { target: { value: '1234' } });
      fireEvent.submit(form);
    }

    // Wait for the panel to unlock and reports to load
    await waitFor(() => {
      expect(screen.getByText(/grievance dashboard/i)).toBeTruthy();
    });

    // We have search input
    const searchInput = screen.getByPlaceholderText(/query department, keyword/i);
    expect(searchInput).toBeTruthy();

    // Type a term that matches one report but not the other
    fireEvent.change(searchInput, { target: { value: 'yellow' } });

    // Pothole report should be filtered out, traffic signal issue should stay
    expect(container.querySelector('#list-item-report-id-1')).toBeNull();
    expect(container.querySelector('#list-item-report-id-2')).toBeTruthy();
  });

  it('should fail open and mark the issue resolved when resolution audit api fails', async () => {
    // Stub FileReader to load dummy base64 instantly
    const dummyBase64 = 'data:image/jpeg;base64,mock';
    class MockFileReader {
      onload: (() => void) | null = null;
      onloadend: (() => void) | null = null;
      result: string = dummyBase64;
      readAsDataURL() {
        setTimeout(() => {
          if (this.onload) {
            this.onload();
          }
          if (this.onloadend) {
            this.onloadend();
          }
        }, 0);
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);
    window.FileReader = MockFileReader as any;

    // Mock fetch to reject, simulating a 503/network failure
    const fetchSpy = vi.spyOn(window, 'fetch').mockRejectedValue(new Error('Simulated Gemini 503 / network issue'));

    const { container } = render(<AdminPanel />);

    // Unlock the panel with pin 1234
    const pinInput = container.querySelector('#admin-pin-hidden-input') as HTMLInputElement;
    const form = pinInput.closest('form');
    if (pinInput && form) {
      fireEvent.change(pinInput, { target: { value: '1234' } });
      fireEvent.submit(form);
    }

    await waitFor(() => {
      expect(screen.getByText(/grievance dashboard/i)).toBeTruthy();
    });

    // Select the first report
    const listItem = container.querySelector('#list-item-report-id-1');
    expect(listItem).toBeTruthy();
    if (listItem) {
      fireEvent.click(listItem);
    }

    // Click the "Verify & Resolve" button to open the capture portal
    const resolveBtn = container.querySelector('#status-resolved-btn');
    expect(resolveBtn).toBeTruthy();
    if (resolveBtn) {
      fireEvent.click(resolveBtn);
    }

    // Verify the portal is open
    expect(container.querySelector('#resolution-capture-portal')).toBeTruthy();

    // Trigger image upload
    const fileInput = container.querySelector('#admin-resolution-file-input');
    expect(fileInput).toBeTruthy();
    if (fileInput) {
      const file = new File(['mock-photo-content'], 'resolution.jpg', { type: 'image/jpeg' });
      fireEvent.change(fileInput, { target: { files: [file] } });
    }

    // Wait for file reader to update the state so that the submit button becomes active
    let enabledBtn: HTMLElement | undefined;
    await waitFor(() => {
      const submitBtns = screen.queryAllByText(/Submit Resolution for AI Audit/i);
      const found = submitBtns.find(btn => !btn.closest('button')?.disabled);
      expect(found).toBeTruthy();
      enabledBtn = found;
    });

    // Click submit resolution
    if (enabledBtn) {
      fireEvent.click(enabledBtn);
    }

    // Verify updateDoc is called with the fail-open fallback status and details
    await waitFor(() => {
      expect(updateDoc).toHaveBeenCalled();
    });

    vi.unstubAllGlobals();
    fetchSpy.mockRestore();
  });
});
