import React from 'react';
import { Activity, X, Shield, Cpu, RefreshCw } from 'lucide-react';
import { useCall } from '../../context/CallContext';

export default function DiagnosticsPanel() {
  const { diagnosticsLogs, isDiagnosticsOpen, setIsDiagnosticsOpen, activeCall } = useCall();

  if (!isDiagnosticsOpen) return null;

  return (
    <div
      className="glass-panel-elevated"
      style={{
        position: 'fixed',
        bottom: '80px',
        right: '20px',
        width: '380px',
        maxHeight: '440px',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 2200,
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.8)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid rgba(0, 210, 255, 0.3)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-glass)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} color="#00d2ff" />
          <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff' }}>
            Call Diagnostics
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsDiagnosticsOpen(false)}
          className="btn-icon"
          style={{ width: 28, height: 28 }}
        >
          <X size={15} />
        </button>
      </div>

      {/* Summary Chips */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          padding: '10px 14px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderBottom: '1px solid var(--border-glass)',
          fontSize: '0.74rem',
        }}
      >
        <span className="badge" style={{ background: 'rgba(0, 102, 255, 0.2)', color: '#38bdf8' }}>
          Status: {activeCall?.status || 'IDLE'}
        </span>
        <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>
          STUN + TURN Active
        </span>
        <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc' }}>
          Logs: {diagnosticsLogs.length}
        </span>
      </div>

      {/* Log Feed */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px 14px',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.72rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        {diagnosticsLogs.length === 0 ? (
          <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '20px 0' }}>
            No diagnostics logged yet.
          </div>
        ) : (
          diagnosticsLogs.map((log, index) => {
            const isError = log.category.includes('ERR') || log.category.includes('FAIL');
            const isTurn = log.category.includes('TURN');
            return (
              <div
                key={index}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  background: isError
                    ? 'rgba(239, 68, 68, 0.15)'
                    : isTurn
                    ? 'rgba(168, 85, 247, 0.12)'
                    : 'rgba(255, 255, 255, 0.03)',
                  borderLeft: isError
                    ? '3px solid #ef4444'
                    : isTurn
                    ? '3px solid #c084fc'
                    : '3px solid #0066ff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                  <span style={{ fontWeight: 600, color: isError ? '#f87171' : isTurn ? '#d8b4fe' : '#38bdf8' }}>
                    [{log.category}]
                  </span>
                  <span>{log.timeFormatted}</span>
                </div>
                <div style={{ color: '#f8fafc', marginTop: '2px', wordBreak: 'break-all' }}>
                  {log.message}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
