'use client';

import React, { useState, useEffect } from 'react';

interface Partner {
  id: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
  role: 'ROLE_MERCHANT' | 'ROLE_COURIER';
  status: 'ACTIVE' | 'PENDING_APPROVAL' | 'SUSPENDED' | 'REJECTED';
  statusReason?: string;
  createdAt: string;
  businessName?: string;
  registrationNumber?: string;
  vehicleType?: string;
  licensePlate?: string;
}

export default function AdminApprovalsPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [filterRole, setFilterRole] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('PENDING_APPROVAL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Modal State for Reject / Suspend reason
  const [actionTarget, setActionTarget] = useState<Partner | null>(null);
  const [actionType, setActionType] = useState<'REJECT' | 'SUSPEND' | null>(null);
  const [reasonInput, setReasonInput] = useState<string>('');
  const [submittingAction, setSubmittingAction] = useState<boolean>(false);

  // Fetch partners from auth-service via gateway
  const fetchPartners = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/auth/admin/users?role=${filterRole === 'ALL' ? '' : filterRole}&status=${filterStatus === 'ALL' ? '' : filterStatus}&search=${searchQuery}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setPartners(data.content || data || []);
      }
    } catch (err) {
      console.error('Failed to fetch partners:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, [filterRole, filterStatus]);

  const handleApprove = async (partner: Partner) => {
    if (!confirm(`Are you sure you want to APPROVE ${partner.fullName}?`)) return;
    try {
      const res = await fetch(`/api/v1/auth/admin/users/${partner.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`,
        },
      });
      if (res.ok) {
        fetchPartners();
      }
    } catch (err) {
      console.error('Failed to approve partner:', err);
    }
  };

  const handleConfirmAction = async () => {
    if (!actionTarget || !actionType) return;
    if (!reasonInput.trim()) {
      alert('Please enter a mandatory audit reason.');
      return;
    }
    setSubmittingAction(true);
    try {
      const endpoint = actionType === 'REJECT'
        ? `/api/v1/auth/admin/users/${actionTarget.id}/reject`
        : `/api/v1/auth/admin/users/${actionTarget.id}/suspend`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`,
        },
        body: JSON.stringify({ reason: reasonInput }),
      });
      if (res.ok) {
        setActionTarget(null);
        setActionType(null);
        setReasonInput('');
        fetchPartners();
      }
    } catch (err) {
      console.error('Failed to update partner state:', err);
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', margin: 0, color: '#111827' }}>
            Partner Approval & Review Queue
          </h1>
          <p style={{ color: '#6b7280', margin: '0.25rem 0 0 0' }}>
            Member 3 — Review, verify, approve, and manage B2B Merchant and Courier partner accounts.
          </p>
        </div>
        <button
          onClick={fetchPartners}
          style={{
            backgroundColor: '#3b82f6',
            color: '#fff',
            border: 'none',
            padding: '0.6rem 1.2rem',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Refresh List
        </button>
      </div>

      {/* Filter Toolbar */}
      <div style={{ display: 'flex', gap: '1rem', backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Role</label>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#fff' }}
          >
            <option value="ALL">All Partners</option>
            <option value="ROLE_MERCHANT">B2B Merchants</option>
            <option value="ROLE_COURIER">Couriers / Drivers</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#fff' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Search</label>
          <input
            type="text"
            placeholder="Search by name, email, registration #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchPartners()}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#fff' }}
          />
        </div>
      </div>

      {/* Partner Table */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
            <tr>
              <th style={{ padding: '0.75rem 1rem', color: '#4b5563', fontWeight: 600 }}>Partner / Contact</th>
              <th style={{ padding: '0.75rem 1rem', color: '#4b5563', fontWeight: 600 }}>Role</th>
              <th style={{ padding: '0.75rem 1rem', color: '#4b5563', fontWeight: 600 }}>Verification Details</th>
              <th style={{ padding: '0.75rem 1rem', color: '#4b5563', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '0.75rem 1rem', color: '#4b5563', fontWeight: 600, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>Loading partners...</td>
              </tr>
            ) : partners.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>No partners found matching the filter criteria.</td>
              </tr>
            ) : (
              partners.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ fontWeight: 600, color: '#111827' }}>{p.fullName}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>{p.email} • {p.phoneNumber || 'No phone'}</div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: p.role === 'ROLE_MERCHANT' ? '#e0e7ff' : '#ecfdf5',
                      color: p.role === 'ROLE_MERCHANT' ? '#3730a3' : '#065f46',
                    }}>
                      {p.role === 'ROLE_MERCHANT' ? 'Merchant' : 'Courier'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    {p.role === 'ROLE_MERCHANT' ? (
                      <div>
                        <div><strong>Business:</strong> {p.businessName || '—'}</div>
                        <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>Reg #: {p.registrationNumber || '—'}</div>
                      </div>
                    ) : (
                      <div>
                        <div><strong>Vehicle:</strong> {p.vehicleType || '—'}</div>
                        <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>Plate: {p.licensePlate || '—'}</div>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor:
                        p.status === 'ACTIVE' ? '#d1fae5' :
                        p.status === 'PENDING_APPROVAL' ? '#fef3c7' :
                        p.status === 'SUSPENDED' ? '#fee2e2' : '#f3f4f6',
                      color:
                        p.status === 'ACTIVE' ? '#047857' :
                        p.status === 'PENDING_APPROVAL' ? '#b45309' :
                        p.status === 'SUSPENDED' ? '#b91c1c' : '#4b5563',
                    }}>
                      {p.status.replace('_', ' ')}
                    </span>
                    {p.statusReason && (
                      <div style={{ color: '#b91c1c', fontSize: '0.75rem', marginTop: '0.2rem' }}>Reason: {p.statusReason}</div>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    {p.status === 'PENDING_APPROVAL' && (
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleApprove(p)}
                          style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '0.35rem 0.7rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => { setActionTarget(p); setActionType('REJECT'); }}
                          style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '0.35rem 0.7rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    {p.status === 'ACTIVE' && (
                      <button
                        onClick={() => { setActionTarget(p); setActionType('SUSPEND'); }}
                        style={{ backgroundColor: '#f59e0b', color: '#fff', border: 'none', padding: '0.35rem 0.7rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}
                      >
                        Suspend
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mandatory Reason Modal */}
      {actionTarget && actionType && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '8px', maxWidth: '450px', width: '100%' }}>
            <h3 style={{ marginTop: 0, color: '#111827' }}>
              {actionType === 'REJECT' ? 'Reject Partner Application' : 'Suspend Partner Account'}
            </h3>
            <p style={{ color: '#4b5563', fontSize: '0.875rem' }}>
              Target: <strong>{actionTarget.fullName}</strong> ({actionTarget.email})
            </p>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>
              Mandatory Audit Reason:
            </label>
            <textarea
              rows={3}
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder="e.g. Invalid business registration document or policy violation..."
              style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                onClick={() => { setActionTarget(null); setActionType(null); setReasonInput(''); }}
                style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', backgroundColor: '#fff', borderRadius: '6px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={submittingAction}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: actionType === 'REJECT' ? '#ef4444' : '#f59e0b',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {submittingAction ? 'Submitting...' : `Confirm ${actionType === 'REJECT' ? 'Rejection' : 'Suspension'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
