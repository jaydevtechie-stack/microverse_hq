// Hardcoded pending a real task-service/business-services API.
export const ANALYST = {
  initials: 'JD',
  name: 'Jane Doe',
  role: 'gofeeler:analyst',
  rating: 4.8,
};

export const METRICS = [
  { label: 'Tasks completed', value: '42' },
  { label: 'Avg turnaround', value: '1.8d' },
  { label: 'Efficiency', value: '93%' },
];

// urgency: 'ok' | 'warn' | 'overdue' — mirrors the green/yellow/red
// dot convention from ARCHITECTURE.md's task pool notes.
export const TASKS = [
  { id: '#1024', service: 'Gofeeler', due: 'due in 5 days', urgency: 'ok' },
  { id: '#1030', service: 'Gofeeler', due: 'due tomorrow', urgency: 'warn' },
];
