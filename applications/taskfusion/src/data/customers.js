// Hardcoded pending a real order-service/business-services API.
export const CUSTOMER = {
  initials: 'AF',
  name: 'Acme Forestry',
  sub: 'Company · 3 customer users',
};

export const ORDERS = [
  { id: '#1024', service: 'Gofeeler', status: 'in progress' },
  { id: '#1026', service: 'Gofeeler', status: 'overdue' },
  { id: '#1031', service: 'SpringPix', status: 'unassigned' },
];

export const INVOICES = [
  { id: 'INV-0091', amount: '$420.00', status: 'paid' },
  { id: 'INV-0095', amount: '$180.00', status: 'unpaid' },
];
