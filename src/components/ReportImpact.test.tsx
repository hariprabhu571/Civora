import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ReportImpact from './ReportImpact';
import { CivicReport } from '../types';

const mockReports: CivicReport[] = [
  {
    id: 'report-1',
    category: 'Pothole',
    status: 'Reported',
    confirmedUsers: ['user-123'],
    responsible_department: 'Municipal Corporation',
    timestamp: { seconds: 1719262800 },
    formal_complaint_text: 'Pothole report text',
    photoUrl: 'mock-photo-url-1',
    userNotes: 'Pothole in middle of road',
    confirmations: 1,
    location: {
      lat: 12.9716,
      lng: 77.5946
    },
    severity: 'Medium',
    reporterEmail: 'test@example.com'
  },
  {
    id: 'report-2',
    category: 'Traffic Signal Issue',
    status: 'Resolved',
    confirmedUsers: ['user-123', 'user-456'],
    responsible_department: 'Traffic Police',
    timestamp: { seconds: 1719266400 },
    formal_complaint_text: 'Traffic issue text',
    photoUrl: 'mock-photo-url-2',
    userNotes: 'Lights are blinking endlessly',
    confirmations: 2,
    location: {
      lat: 12.9716,
      lng: 77.5946
    },
    severity: 'High',
    reporterEmail: 'test2@example.com'
  }
];

describe('ReportImpact Component', () => {
  it('should return null when there are no reports for the user', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <ReportImpact reports={mockReports} userUuid="unregistered-user" onSelectReport={onSelect} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render the active report correctly when matching the user', () => {
    const onSelect = vi.fn();
    render(
      <ReportImpact reports={mockReports} userUuid="user-123" onSelectReport={onSelect} />
    );

    // Should find the first report's specific text
    expect(screen.getByText('Your Report Impact')).toBeTruthy();
    expect(screen.getByText(/pothole/i)).toBeTruthy();
    expect(screen.getByText('1/2')).toBeTruthy();
  });

  it('should support pagination and click triggers', async () => {
    const onSelect = vi.fn();
    render(
      <ReportImpact reports={mockReports} userUuid="user-123" onSelectReport={onSelect} />
    );

    // Verify first card select triggering callback
    const card = document.getElementById('user-report-impact-card');
    expect(card).toBeTruthy();
    if (card) {
      fireEvent.click(card);
      expect(onSelect).toHaveBeenCalledWith('report-1');
    }

    // Go to next report
    const nextBtn = document.getElementById('next-impact-report-btn');
    expect(nextBtn).toBeTruthy();
    if (nextBtn) {
      fireEvent.click(nextBtn);
    }

    // Now should display the second report (Traffic Signal Issue) after animation
    const secondReportText = await screen.findByText(/traffic signal issue/i);
    expect(secondReportText).toBeTruthy();
    
    const pageIndicatorText = await screen.findByText('2/2');
    expect(pageIndicatorText).toBeTruthy();

    if (card) {
      fireEvent.click(card);
      expect(onSelect).toHaveBeenCalledWith('report-2');
    }
  });
});
