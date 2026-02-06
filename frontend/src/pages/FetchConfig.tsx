/**
 * Fetch Configuration page component.
 *
 * This page allows users to:
 * - Browse available StatFin datasets
 * - Configure which datasets to fetch
 * - Manage fetch schedules and settings
 *
 * Uses TableBrowser component for StatFin table navigation
 * and provides forms for configuring data fetches.
 */

import { useState, useCallback } from 'react';
import { TableBrowser } from '../components/TableBrowser';
import { FetchConfigForm } from '../components/FetchConfigForm';
import { FetchConfigList } from '../components/FetchConfigList';
import type { StatFinTableInfo } from '../types/api';

/**
 * Tab component for switching between views
 */
function Tabs({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: Array<{ id: string; label: string }>;
  activeTab: string;
  onTabChange: (id: string) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--spacing-2)',
        borderBottom: '1px solid var(--color-gray-200)',
        marginBottom: 'var(--spacing-4)',
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          style={{
            padding: 'var(--spacing-2) var(--spacing-4)',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: 500,
            borderBottom: `2px solid ${
              activeTab === tab.id ? 'var(--color-primary)' : 'transparent'
            }`,
            color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-gray-600)',
            marginBottom: '-1px',
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Main Fetch Configuration page component
 */
export default function FetchConfig() {
  const [activeTab, setActiveTab] = useState('configurations');
  const [selectedTable, setSelectedTable] = useState<StatFinTableInfo | null>(null);

  const tabs = [
    { id: 'configurations', label: 'Configurations' },
    { id: 'browse', label: 'Browse StatFin' },
    { id: 'add', label: 'Add New' },
  ];

  // Handle table selection from browser
  const handleTableSelect = useCallback((table: StatFinTableInfo) => {
    setSelectedTable(table);
    // Switch to add tab to configure the selected table
    setActiveTab('add');
  }, []);

  return (
    <div className="page">
      <div className="flex justify-between items-center mb-4">
        <h2 style={{ marginBottom: 0 }}>Fetch Configuration</h2>
      </div>

      <p className="text-muted" style={{ marginBottom: 'var(--spacing-4)' }}>
        Configure which StatFin datasets to fetch and manage data collection schedules.
      </p>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'configurations' && (
        <div className="card">
          <FetchConfigList onAddNew={() => setActiveTab('add')} />
        </div>
      )}

      {activeTab === 'browse' && (
        <div>
          <div className="card" style={{ marginBottom: 'var(--spacing-4)' }}>
            <h4>Browse StatFin Database</h4>
            <p className="text-muted">
              Explore available statistical tables from Statistics Finland's database.
              Click on a table to configure it for data fetching.
            </p>
          </div>
          <TableBrowser onTableSelect={handleTableSelect} />
        </div>
      )}

      {activeTab === 'add' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--spacing-4)',
          }}
        >
          <FetchConfigForm
            selectedTable={selectedTable}
            onSuccess={() => {
              setSelectedTable(null);
              setActiveTab('configurations');
            }}
            onClear={() => setSelectedTable(null)}
          />
          <div className="card">
            <h4>Instructions</h4>
            <ol
              style={{
                paddingLeft: 'var(--spacing-5)',
                lineHeight: 1.8,
              }}
            >
              <li>Browse the StatFin database to find the table you want</li>
              <li>Copy the table path (e.g., StatFin/vrm/vaerak)</li>
              <li>Enter a descriptive name for the dataset</li>
              <li>Configure the fetch interval</li>
              <li>Save the configuration</li>
            </ol>
            <div
              className="card"
              style={{
                marginTop: 'var(--spacing-4)',
                backgroundColor: 'var(--color-gray-50)',
              }}
            >
              <h5>Helpful Links</h5>
              <ul style={{ paddingLeft: 'var(--spacing-5)', lineHeight: 1.8 }}>
                <li>
                  <a
                    href="https://pxdata.stat.fi/PxWeb/pxweb/fi/StatFin/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    StatFin Database Browser
                  </a>
                </li>
                <li>
                  <a
                    href="https://stat.fi/til/index.html"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Statistics Finland Documentation
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
