import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';

const API_BASE = (import.meta.env.VITE_API_URL as string) || '';

// === Define allowed document types ===
const DOCUMENT_TYPES = ['Type1', 'Type2', 'Type3', 'TypeN'] as const;
type DocType = (typeof DOCUMENT_TYPES)[number];

// === Runtime type guard ===
function isValidDocType(type: any): type is DocType {
  return typeof type === 'string' && (DOCUMENT_TYPES as readonly string[]).includes(type);
}

// === Final DocData type (strict) ===
interface DocData {
  matched_blueprint: {
    name: string;
    confidence: number;
  };
  document_class: {
    type: DocType;
  };
  inference_result: Record<string, any>;
}

// === Hierarchical renderer ===
function renderValue(value: any, level: number = 0): JSX.Element {
  const baseClasses = 'break-words';
  const levelClasses = [
    'text-lg font-semibold text-blue-900',
    'text-base font-medium text-gray-800',
    'text-sm text-gray-700',
    'text-xs text-gray-600 pl-4',
  ];
  const indent = level > 0 ? `pl-${Math.min(level * 4, 12)}` : '';

  if (value === null || value === undefined) {
    return <span className={`${baseClasses} ${levelClasses[2]} italic`}>(empty)</span>;
  }

  if (typeof value !== 'object') {
    return <span className={`${baseClasses} ${levelClasses[Math.min(level + 1, 3)]}`}>{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className={`${baseClasses} ${levelClasses[2]} italic`}>(empty list)</span>;
    }
    return (
      <ul className={`list-none ${indent} space-y-1`}>
        {value.map((item, i) => (
          <li key={i} className="flex items-start">
            <span className="text-blue-600 mr-2">•</span>
            <div className="flex-1">{renderValue(item, level + 1)}</div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={`${indent} space-y-2`}>
      {Object.entries(value).map(([k, v]) => (
        <div key={k}>
          <div className={`${levelClasses[Math.min(level + 1, 2)]}`}>
            {k.replace(/_/g, ' ')}:
          </div>
          <div className="mt-1">{renderValue(v, level + 1)}</div>
        </div>
      ))}
    </div>
  );
}

function renderInferenceResult(result: Record<string, any>): JSX.Element {
  return (
    <div className="space-y-8">
      {Object.entries(result).map(([groupKey, groupValue]) => (
        <div key={groupKey} className="border-l-4 border-blue-600 pl-5 pb-4">
          <h4 className="text-xl font-bold text-blue-800 capitalize mb-3">
            {groupKey.replace(/_/g, ' ')}
          </h4>
          {renderValue(groupValue, 0)}
        </div>
      ))}
    </div>
  );
}

export default function DocView() {
  const [doc, setDoc] = useState<DocData | null>(null);
  const [docId, setDocId] = useState('');
  const [s3Key, setS3Key] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<DocType>('Type1');

  // === Load sample data if no API ===
  useEffect(() => {
    if (!API_BASE) {
      import('./sampledata/result_bda_blueprint.json').then((m) => {
        const rawData = m.default || m;

        if (rawData?.document_class?.type && isValidDocType(rawData.document_class.type)) {
          const validated: DocData = {
            matched_blueprint: rawData.matched_blueprint || { name: 'Unknown', confidence: 0 },
            document_class: { type: rawData.document_class.type },
            inference_result: rawData.inference_result || {},
          };
          setDoc(validated);
          setActiveTab(validated.document_class.type);
        } else {
          console.warn('Sample data has invalid document_class.type:', rawData?.document_class?.type);
        }
      });
    }
  }, []);

  const getAuthToken = async () => {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.toString();
    } catch (e) {
      console.error('Failed to get auth token:', e);
      return null;
    }
  };

  const fetchDoc = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      const params: any = {};
      if (docId) params.docId = docId;
      if (s3Key) params.s3Key = s3Key;

      let rawData: any;

      if (!API_BASE) {
        const sample = await import('./sampledata/result_bda_blueprint.json');
        rawData = sample.default || sample;
      } else {
        if (!token) {
          alert('No auth token available');
          return;
        }

        const resp = await axios.get(API_BASE + '/doc', {
          params,
          headers: { Authorization: token },
        });
        rawData = resp.data.document || resp.data.doc || resp.data;
      }

      // === VALIDATE & CAST ===
      if (rawData?.document_class?.type && isValidDocType(rawData.document_class.type)) {
        const validated: DocData = {
          matched_blueprint: rawData.matched_blueprint || { name: 'Unknown', confidence: 0 },
          document_class: { type: rawData.document_class.type },
          inference_result: rawData.inference_result || {},
        };
        setDoc(validated);
        setActiveTab(validated.document_class.type);
      } else {
        console.error('Invalid document_class.type:', rawData?.document_class?.type);
        alert('Invalid document type received');
        setDoc(null);
      }
    } catch (e: any) {
      alert('error: ' + (e?.response?.data?.error || e?.message));
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (status: string) => {
    if (!docId) {
      alert('docId required');
      return;
    }
    try {
      setLoading(true);
      const token = await getAuthToken();
      if (!token) {
        alert('No auth token available');
        return;
      }
      const updates: any = { status };
      await axios.post(API_BASE + '/doc', { docId, updates }, { headers: { Authorization: token } });
      alert('status updated: ' + status);
    } catch (e: any) {
      alert('error: ' + (e?.response?.data?.error || e?.message));
    } finally {
      setLoading(false);
    }
  };

  const currentDocType = doc?.document_class?.type;

  return (
    <div className="max-w-5xl mx-auto p-6 font-sans">
      {/* Input Row */}
      <div className="flex gap-3 mb-8">
        <input
          placeholder="docId"
          value={docId}
          onChange={(e) => setDocId(e.target.value)}
          disabled={loading}
          className="border border-gray-300 rounded-lg px-4 py-2 flex-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <input
          placeholder="s3Key (optional)"
          value={s3Key}
          onChange={(e) => setS3Key(e.target.value)}
          disabled={loading}
          className="border border-gray-300 rounded-lg px-4 py-2 flex-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          onClick={fetchDoc}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium transition"
        >
          {loading ? 'Loading...' : 'Load'}
        </button>
      </div>

      {doc && (
        <>
          {/* Header */}
          <div className="mb-8 p-5 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-blue-200">
            <h1 className="text-3xl font-extrabold text-indigo-900">
              {doc.matched_blueprint.name}
            </h1>
            <p className="text-sm text-indigo-700 mt-1">
              Confidence:{' '}
              <span className="font-bold text-indigo-900">
                {(doc.matched_blueprint.confidence * 100).toFixed(2)}%
              </span>
            </p>
          </div>

          {/* Tabs + Content */}
          <div className="flex gap-8">
            {/* Vertical Tabs */}
            <div className="w-56 space-y-2">
              {DOCUMENT_TYPES.map((type) => {
                const isActive = currentDocType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setActiveTab(type)}
                    disabled={!isActive}
                    className={`
                      w-full text-left px-5 py-4 rounded-lg font-semibold transition-all duration-200
                      ${isActive
                        ? 'bg-blue-600 text-white shadow-lg scale-105'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 opacity-60'
                      }
                    `}
                  >
                    {type}
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div className="flex-1 bg-white p-8 rounded-xl shadow-md border border-gray-200">
              {currentDocType && currentDocType === activeTab ? (
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                    {currentDocType}
                    <span className="ml-3 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                  </h2>
                  {renderInferenceResult(doc.inference_result)}
                </div>
              ) : (
                <div className="text-center py-16 text-gray-500">
                  <p className="text-lg font-medium">Document type mismatch</p>
                  <p className="mt-2">
                    Expected: <strong className="text-blue-600">{activeTab}</strong>
                    <br />
                    Found: <strong className="text-red-600">{currentDocType}</strong>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-10 flex justify-center gap-4">
            <button
              onClick={() => updateStatus('PROVED')}
              disabled={loading}
              className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-semibold text-lg shadow-md transition"
            >
              Prove
            </button>
            <button
              onClick={() => updateStatus('REJECTED')}
              disabled={loading}
              className="bg-red-600 text-white px-8 py-3 rounded-lg hover:bg-red-700 disabled:bg-gray-400 font-semibold text-lg shadow-md transition"
            >
              Reject
            </button>
          </div>
        </>
      )}

      {!doc && !loading && (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg">
            Enter a <code className="bg-gray-100 px-2 py-1 rounded">docId</code> and click <strong>Load</strong> to begin.
          </p>
        </div>
      )}
    </div>
  );
}