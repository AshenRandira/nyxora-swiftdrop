'use client';

import React, { useState, useEffect } from 'react';

interface DeliveryZone {
  id: number;
  zoneCode: string;
  zoneName: string;
  district: string;
  baseSurcharge: number;
  isActive: boolean;
}

interface PricingRule {
  id: number;
  originZone: DeliveryZone;
  destinationZone: DeliveryZone;
  baseFee: number;
  ratePerKg: number;
  parcelSize: 'SMALL' | 'MEDIUM' | 'LARGE';
  sizeMultiplier: number;
}

interface QuoteResponse {
  appliedTier: string;
  baseFee: number;
  weightCharge: number;
  sizeMultiplier: number;
  zoneSurcharge: number;
  discountAmount: number;
  expressSurcharge: number;
  totalFee: number;
}

export default function AdminPricingPage() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [activeTab, setActiveTab] = useState<'ZONES' | 'RULES' | 'CALCULATOR'>('ZONES');
  const [loading, setLoading] = useState<boolean>(true);

  // Modal: Create Delivery Zone
  const [showZoneModal, setShowZoneModal] = useState<boolean>(false);
  const [zoneCode, setZoneCode] = useState<string>('');
  const [zoneName, setZoneName] = useState<string>('');
  const [district, setDistrict] = useState<string>('');
  const [baseSurcharge, setBaseSurcharge] = useState<string>('0.00');

  // Modal: Create Pricing Rule
  const [showRuleModal, setShowRuleModal] = useState<boolean>(false);
  const [originZoneId, setOriginZoneId] = useState<number>(0);
  const [destZoneId, setDestZoneId] = useState<number>(0);
  const [baseFee, setBaseFee] = useState<string>('200.00');
  const [ratePerKg, setRatePerKg] = useState<string>('30.00');
  const [parcelSize, setParcelSize] = useState<'SMALL' | 'MEDIUM' | 'LARGE'>('SMALL');
  const [sizeMultiplier, setSizeMultiplier] = useState<string>('1.00');

  // Interactive Live Calculator (GoF Strategy Demo for Viva Act 2A)
  const [calcOrigin, setCalcOrigin] = useState<number>(0);
  const [calcDest, setCalcDest] = useState<number>(0);
  const [calcWeight, setCalcWeight] = useState<string>('2.5');
  const [calcSize, setCalcSize] = useState<'SMALL' | 'MEDIUM' | 'LARGE'>('SMALL');
  const [calcTier, setCalcTier] = useState<'STANDARD' | 'MERCHANT' | 'EXPRESS'>('STANDARD');
  const [quoteResult, setQuoteResult] = useState<QuoteResponse | null>(null);

  const fetchZones = async () => {
    try {
      const res = await fetch('/api/v1/zones', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`,
          'X-User-Role': 'ROLE_ADMIN'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setZones(data);
        if (data.length > 0) {
          setOriginZoneId(data[0].id);
          setDestZoneId(data[0].id);
          setCalcOrigin(data[0].id);
          setCalcDest(data[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load delivery zones:', e);
    }
  };

  const fetchRules = async () => {
    try {
      const res = await fetch('/api/v1/pricing/rules', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`,
          'X-User-Role': 'ROLE_ADMIN'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setRules(data);
      }
    } catch (e) {
      console.error('Failed to load pricing rules:', e);
    }
  };

  useEffect(() => {
    Promise.all([fetchZones(), fetchRules()]).finally(() => setLoading(false));
  }, []);

  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/zones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`,
          'X-User-Role': 'ROLE_ADMIN'
        },
        body: JSON.stringify({
          zoneCode,
          zoneName,
          district,
          baseSurcharge: parseFloat(baseSurcharge)
        })
      });
      if (res.ok) {
        setShowZoneModal(false);
        setZoneCode('');
        setZoneName('');
        setDistrict('');
        setBaseSurcharge('0.00');
        fetchZones();
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to create zone');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleZone = async (zone: DeliveryZone) => {
    try {
      const res = await fetch(`/api/v1/zones/${zone.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`,
          'X-User-Role': 'ROLE_ADMIN'
        },
        body: JSON.stringify({ isActive: !zone.isActive })
      });
      if (res.ok) fetchZones();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/pricing/rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`,
          'X-User-Role': 'ROLE_ADMIN'
        },
        body: JSON.stringify({
          originZoneId,
          destinationZoneId: destZoneId,
          baseFee: parseFloat(baseFee),
          ratePerKg: parseFloat(ratePerKg),
          parcelSize,
          sizeMultiplier: parseFloat(sizeMultiplier)
        })
      });
      if (res.ok) {
        setShowRuleModal(false);
        fetchRules();
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to create rule');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Simulates live GoF strategy execution
  const calculatePreview = () => {
    const origin = zones.find(z => z.id === calcOrigin);
    const dest = zones.find(z => z.id === calcDest);
    if (!origin || !dest) return;

    const rule = rules.find(r =>
      r.originZone.id === calcOrigin &&
      r.destinationZone.id === calcDest &&
      r.parcelSize === calcSize
    );

    if (!rule) {
      alert(`No pricing rule configured for ${origin.zoneCode} → ${dest.zoneCode} (${calcSize})`);
      return;
    }

    const weight = parseFloat(calcWeight) || 1.0;
    let bFee = rule.baseFee;
    let rKg = rule.ratePerKg;
    let discount = 0;
    let expressSur = 0;

    if (calcTier === 'MERCHANT') {
      // 15% corporate discount
      discount = (bFee + weight * rKg) * 0.15;
      bFee = bFee * 0.85;
      rKg = rKg * 0.85;
    }

    const weightChg = weight * rKg;
    const subtotal = (bFee + weightChg) * rule.sizeMultiplier;

    let finalFee = subtotal;
    if (calcTier === 'EXPRESS') {
      // 1.5x expedited multiplier
      expressSur = subtotal * 0.5;
      finalFee = subtotal * 1.5;
    }

    finalFee += dest.baseSurcharge;

    setQuoteResult({
      appliedTier: calcTier,
      baseFee: bFee,
      weightCharge: weightChg,
      sizeMultiplier: rule.sizeMultiplier,
      zoneSurcharge: dest.baseSurcharge,
      discountAmount: discount,
      expressSurcharge: expressSur,
      totalFee: finalFee
    });
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', margin: 0, color: '#111827' }}>
            Sri Lankan Delivery Zones & Dynamic Pricing Matrix
          </h1>
          <p style={{ color: '#6b7280', margin: '0.25rem 0 0 0' }}>
            Member 3 — Manage geographical districts, base surcharges, and inter-zone GoF Strategy pricing rules.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setShowZoneModal(true)}
            style={{ backgroundColor: '#3b82f6', color: '#fff', border: 'none', padding: '0.6rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
          >
            + Add Delivery Zone
          </button>
          <button
            onClick={() => setShowRuleModal(true)}
            style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '0.6rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
          >
            + Add Pricing Rule
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setActiveTab('ZONES')}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            borderBottom: activeTab === 'ZONES' ? '3px solid #3b82f6' : 'none',
            color: activeTab === 'ZONES' ? '#3b82f6' : '#6b7280'
          }}
        >
          Delivery Zones ({zones.length})
        </button>
        <button
          onClick={() => setActiveTab('RULES')}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            borderBottom: activeTab === 'RULES' ? '3px solid #3b82f6' : 'none',
            color: activeTab === 'RULES' ? '#3b82f6' : '#6b7280'
          }}
        >
          Pricing Rules Matrix ({rules.length})
        </button>
        <button
          onClick={() => setActiveTab('CALCULATOR')}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            borderBottom: activeTab === 'CALCULATOR' ? '3px solid #3b82f6' : 'none',
            color: activeTab === 'CALCULATOR' ? '#3b82f6' : '#6b7280'
          }}
        >
          ⚡ Dynamic Strategy Simulator (Act 2A Demo)
        </button>
      </div>

      {/* Tab 1: Delivery Zones */}
      {activeTab === 'ZONES' && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
              <tr>
                <th style={{ padding: '0.75rem 1rem' }}>Zone Code</th>
                <th style={{ padding: '0.75rem 1rem' }}>Zone Name</th>
                <th style={{ padding: '0.75rem 1rem' }}>District</th>
                <th style={{ padding: '0.75rem 1rem' }}>Base Surcharge (LKR)</th>
                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Toggle State</th>
              </tr>
            </thead>
            <tbody>
              {zones.map(z => (
                <tr key={z.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#1f2937' }}>{z.zoneCode}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>{z.zoneName}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>{z.district}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>Rs. {z.baseSurcharge.toFixed(2)}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: z.isActive ? '#d1fae5' : '#fee2e2',
                      color: z.isActive ? '#065f46' : '#991b1b'
                    }}>
                      {z.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <button
                      onClick={() => handleToggleZone(z)}
                      style={{
                        padding: '0.3rem 0.7rem',
                        fontSize: '0.75rem',
                        borderRadius: '4px',
                        border: '1px solid #d1d5db',
                        cursor: 'pointer',
                        backgroundColor: z.isActive ? '#fee2e2' : '#d1fae5',
                        color: z.isActive ? '#991b1b' : '#065f46'
                      }}
                    >
                      {z.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Pricing Rules Matrix */}
      {activeTab === 'RULES' && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
              <tr>
                <th style={{ padding: '0.75rem 1rem' }}>Route</th>
                <th style={{ padding: '0.75rem 1rem' }}>Parcel Size</th>
                <th style={{ padding: '0.75rem 1rem' }}>Base Fee (LKR)</th>
                <th style={{ padding: '0.75rem 1rem' }}>Rate / kg (LKR)</th>
                <th style={{ padding: '0.75rem 1rem' }}>Size Multiplier</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                    {r.originZone.zoneCode} ({r.originZone.district}) → {r.destinationZone.zoneCode} ({r.destinationZone.district})
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#e0e7ff', color: '#3730a3' }}>
                      {r.parcelSize}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>Rs. {r.baseFee.toFixed(2)}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>Rs. {r.ratePerKg.toFixed(2)} / kg</td>
                  <td style={{ padding: '0.75rem 1rem' }}>{r.sizeMultiplier.toFixed(2)}×</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Dynamic Strategy Simulator (Viva Examiner Act 2A) */}
      {activeTab === 'CALCULATOR' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div style={{ backgroundColor: '#f9fafb', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ marginTop: 0, color: '#111827' }}>Configure Delivery Parameters</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Origin Zone</label>
              <select value={calcOrigin} onChange={e => setCalcOrigin(parseInt(e.target.value))} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                {zones.map(z => <option key={z.id} value={z.id}>{z.zoneCode} — {z.zoneName} ({z.district})</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Destination Zone</label>
              <select value={calcDest} onChange={e => setCalcDest(parseInt(e.target.value))} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                {zones.map(z => <option key={z.id} value={z.id}>{z.zoneCode} — {z.zoneName} ({z.district})</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Weight (kg)</label>
                <input type="number" step="0.1" value={calcWeight} onChange={e => setCalcWeight(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Size Tier</label>
                <select value={calcSize} onChange={e => setCalcSize(e.target.value as any)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                  <option value="SMALL">SMALL (1.0×)</option>
                  <option value="MEDIUM">MEDIUM (1.2×)</option>
                  <option value="LARGE">LARGE (1.5×)</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>GoF Strategy Tier</label>
              <select value={calcTier} onChange={e => setCalcTier(e.target.value as any)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', fontWeight: 600 }}>
                <option value="STANDARD">StandardZonePricingStrategy (Default)</option>
                <option value="MERCHANT">MerchantDiscountPricingStrategy (15% Corporate Discount)</option>
                <option value="EXPRESS">ExpressSameDayPricingStrategy (1.5× Expedited)</option>
              </select>
            </div>
            <button
              onClick={calculatePreview}
              style={{ width: '100%', backgroundColor: '#3b82f6', color: '#fff', padding: '0.75rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              Calculate Quote with Strategy
            </button>
          </div>

          {/* Results Card */}
          <div style={{ backgroundColor: '#ffffff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ marginTop: 0, color: '#111827' }}>Itemized Fee Breakdown</h3>
            {quoteResult ? (
              <div>
                <div style={{ padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Applied Strategy:</span>
                  <strong>{quoteResult.appliedTier}</strong>
                </div>
                <div style={{ padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Base Delivery Fee:</span>
                  <span>Rs. {quoteResult.baseFee.toFixed(2)}</span>
                </div>
                <div style={{ padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Weight Charge:</span>
                  <span>Rs. {quoteResult.weightCharge.toFixed(2)}</span>
                </div>
                <div style={{ padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Size Multiplier:</span>
                  <span>{quoteResult.sizeMultiplier.toFixed(2)}×</span>
                </div>
                <div style={{ padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Zone Destination Surcharge:</span>
                  <span>Rs. {quoteResult.zoneSurcharge.toFixed(2)}</span>
                </div>
                {quoteResult.discountAmount > 0 && (
                  <div style={{ padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', color: '#059669' }}>
                    <span>15% Merchant Corporate Discount:</span>
                    <span>- Rs. {quoteResult.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                {quoteResult.expressSurcharge > 0 && (
                  <div style={{ padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', color: '#d97706' }}>
                    <span>Expedited Same-Day Surcharge (50%):</span>
                    <span>+ Rs. {quoteResult.expressSurcharge.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#166534' }}>Total Delivery Fee:</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#166534' }}>
                    Rs. {quoteResult.totalFee.toFixed(2)} LKR
                  </span>
                </div>
              </div>
            ) : (
              <p style={{ color: '#9ca3af' }}>Select parameters and click "Calculate Quote" to see the live strategy execution.</p>
            )}
          </div>
        </div>
      )}

      {/* Modal: Create Zone */}
      {showZoneModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleCreateZone} style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '8px', maxWidth: '450px', width: '100%' }}>
            <h3 style={{ marginTop: 0 }}>Add New Sri Lankan Delivery Zone</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Zone Code (WP-COL-01)</label>
              <input type="text" required value={zoneCode} onChange={e => setZoneCode(e.target.value)} placeholder="e.g. WP-COL-03" style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Zone Name</label>
              <input type="text" required value={zoneName} onChange={e => setZoneName(e.target.value)} placeholder="e.g. Dehiwala - Mount Lavinia" style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>District</label>
              <input type="text" required value={district} onChange={e => setDistrict(e.target.value)} placeholder="e.g. Colombo" style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }} />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Base Surcharge (LKR)</label>
              <input type="number" step="0.5" required value={baseSurcharge} onChange={e => setBaseSurcharge(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" onClick={() => setShowZoneModal(false)} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', backgroundColor: '#fff', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" style={{ padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Create Zone</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Create Pricing Rule */}
      {showRuleModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleCreateRule} style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '8px', maxWidth: '450px', width: '100%' }}>
            <h3 style={{ marginTop: 0 }}>Create Inter-Zone Pricing Rule</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Origin Zone</label>
              <select value={originZoneId} onChange={e => setOriginZoneId(parseInt(e.target.value))} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                {zones.map(z => <option key={z.id} value={z.id}>{z.zoneCode} — {z.district}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Destination Zone</label>
              <select value={destZoneId} onChange={e => setDestZoneId(parseInt(e.target.value))} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                {zones.map(z => <option key={z.id} value={z.id}>{z.zoneCode} — {z.district}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Base Fee (LKR)</label>
                <input type="number" step="1.0" required value={baseFee} onChange={e => setBaseFee(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Rate / kg (LKR)</label>
                <input type="number" step="0.5" required value={ratePerKg} onChange={e => setRatePerKg(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Size</label>
                <select value={parcelSize} onChange={e => setParcelSize(e.target.value as any)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                  <option value="SMALL">SMALL</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LARGE">LARGE</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Multiplier</label>
                <input type="number" step="0.05" required value={sizeMultiplier} onChange={e => setSizeMultiplier(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" onClick={() => setShowRuleModal(false)} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', backgroundColor: '#fff', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" style={{ padding: '0.5rem 1rem', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Create Rule</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
