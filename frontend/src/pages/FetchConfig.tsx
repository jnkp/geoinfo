/**
 * Fetch Configuration page component.
 *
 * This page allows users to:
 * - Browse available StatFin datasets
 * - Configure which datasets to fetch
 * - Manage fetch schedules and settings
 *
 * Components like TableBrowser and FetchConfigForm
 * will be integrated in later phases.
 */

import { useState } from 'react';
import { useDatasets } from '../api';

/**
 * Placeholder for the StatFin table browser (to be implemented in phase 7)
 */
function TableBrowserPlaceholder() {
  return (
    <div
      className="card"
      style={{
        minHeight: '300px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-gray-50)',
      }}
    >
      <div className="text-center text-muted">
        <div style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--spacing-2)' }}>
          🗂️
        </div>
        <p>StatFin Table Browser</p>
        <p style={{ fontSize: 'var(--font-size-sm)' }}>
          Browse and select tables from StatFin database
        </p>
      </div>
    </div>
  );
}

/**
 * Placeholder for fetch configuration form (to be implemented in phase 7)
 */
function ConfigFormPlaceholder() {
  return (
    <div className="card">
      <h4>New Fetch Configuration</h4>
      <form onSubmit={(e) => e.preventDefault()}>
        <div className="form-group">
          <label className="form-label">Dataset Name</label>
          <input
            type="text"
            className="form-input"
            placeholder="Enter dataset name"
            disabled
          />
        </div>
        <div className="form-group">
          <label className="form-label">StatFin Table Path</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g., StatFin/vrm/vaerak"
            disabled
          />
        </div>
        <div className="form-group">
          <label className="form-label">Fetch Interval</label>
          <select className="form-select" disabled>
            <option>Every 24 hours</option>
            <option>Every 12 hours</option>
            <option>Every 6 hours</option>
            <option>Hourly</option>
          </select>
        </div>
        <div style={{ marginTop: 'var(--spacing-4)' }}>
          <button type="submit" className="btn btn-primary" disabled>
            Save Configuration
          </button>
        </div>
      </form>
      <p
        className="text-muted"
        style={{ marginTop: 'var(--spacing-4)', fontSize: 'var(--font-size-sm)' }}
      >
        Form functionality will be available in a future update.
      </p>
    </div>
  );
}

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
 * List of existing fetch configurations
 */
function ConfigList() {
  const { data: datasets, isLoading, error } = useDatasets({ page: 1, page_size: 50 });

  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <span style={{ marginLeft: 'var(--spacing-3)' }}>
          Loading configurations...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error">
        <div className="error-title">Failed to load configurations</div>
        <p>{error.message}</p>
      </div>
    );
  }

  if (!datasets?.items.length) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: 'var(--spacing-8)',
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: 'var(--spacing-4)' }}>📭</div>
        <h4>No Configurations Yet</h4>
        <p className="text-muted">
          Add a new fetch configuration to start collecting data from StatFin.
        </p>
      </div>
    );
  }

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th
              style={{
                textAlign: 'left',
                padding: 'var(--spacing-2)',
                borderBottom: '1px solid var(--color-gray-200)',
                fontWeight: 600,
              }}
            >
              Dataset
            </th>
            <th
              style={{
                textAlign: 'left',
                padding: 'var(--spacing-2)',
                borderBottom: '1px solid var(--color-gray-200)',
                fontWeight: 600,
              }}
            >
              Table ID
            </th>
            <th
              style={{
                textAlign: 'left',
                padding: 'var(--spacing-2)',
                borderBottom: '1px solid var(--color-gray-200)',
                fontWeight: 600,
              }}
            >
              Time Resolution
            </th>
            <th
              style={{
                textAlign: 'center',
                padding: 'var(--spacing-2)',
                borderBottom: '1px solid var(--color-gray-200)',
                fontWeight: 600,
              }}
            >
              Status
            </th>
            <th
              style={{
                textAlign: 'right',
                padding: 'var(--spacing-2)',
                borderBottom: '1px solid var(--color-gray-200)',
                fontWeight: 600,
              }}
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {datasets.items.map((dataset) => (
            <tr key={dataset.id}>
              <td style={{ padding: 'var(--spacing-2)' }}>
                <div style={{ fontWeight: 500 }}>
                  {dataset.name_fi || dataset.name_en || dataset.id}
                </div>
                {dataset.description && (
                  <div
                    className="text-muted"
                    style={{ fontSize: 'var(--font-size-sm)' }}
                  >
                    {dataset.description}
                  </div>
                )}
              </td>
              <td
                style={{
                  padding: 'var(--spacing-2)',
                  fontFamily: 'monospace',
                  fontSize: 'var(--font-size-sm)',
                }}
              >
                {dataset.statfin_table_id}
              </td>
              <td
                style={{
                  padding: 'var(--spacing-2)',
                  textTransform: 'capitalize',
                }}
              >
                {dataset.time_resolution}
              </td>
              <td style={{ padding: 'var(--spacing-2)', textAlign: 'center' }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: 'var(--spacing-1) var(--spacing-2)',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-success)',
                    color: 'white',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 500,
                  }}
                >
                  Active
                </span>
              </td>
              <td style={{ padding: 'var(--spacing-2)', textAlign: 'right' }}>
                <button className="btn btn-secondary" style={{ marginRight: 'var(--spacing-2)' }} disabled>
                  Edit
                </button>
                <button className="btn btn-secondary" disabled>
                  Fetch Now
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Main Fetch Configuration page component
 */
export default function FetchConfig() {
  const [activeTab, setActiveTab] = useState('configurations');

  const tabs = [
    { id: 'configurations', label: 'Configurations' },
    { id: 'browse', label: 'Browse StatFin' },
    { id: 'add', label: 'Add New' },
  ];

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
          <div className="card-header flex justify-between items-center">
            <h4 className="card-title" style={{ marginBottom: 0 }}>
              Configured Datasets
            </h4>
            <button
              className="btn btn-primary"
              onClick={() => setActiveTab('add')}
            >
              + Add Configuration
            </button>
          </div>
          <ConfigList />
        </div>
      )}

      {activeTab === 'browse' && (
        <div>
          <div className="card" style={{ marginBottom: 'var(--spacing-4)' }}>
            <h4>Browse StatFin Database</h4>
            <p className="text-muted">
              Explore available statistical tables from Statistics Finland's database.
            </p>
          </div>
          <TableBrowserPlaceholder />
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
          <ConfigFormPlaceholder />
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
