import { useState } from 'react';
import api from '../api/client';

export default function VerifyDesk() {
  const [identityHash, setIdentityHash] = useState('');
  const [credentialHash, setCredentialHash] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const run = async (path, body) => {
    setError('');
    setResult(null);
    try {
      const res = await api.post(`/verify/${path}`, body);
      setResult(res.data.data);
    } catch (err) {
      setError(err.apiMessage);
    }
  };

  return (
    <div className="container page">
      <h2>Public verification desk</h2>
      <p className="muted">No account required. Paste SHA-256 hashes from a learner’s passport.</p>
      {error && <div className="alert">{error}</div>}
      <div className="panel form">
        <label>
          Identity hash
          <input value={identityHash} onChange={(e) => setIdentityHash(e.target.value.trim())} />
        </label>
        <label>
          Credential hash
          <input value={credentialHash} onChange={(e) => setCredentialHash(e.target.value.trim())} />
        </label>
        <div className="row">
          <button className="btn btn-soft" type="button" onClick={() => run('identity', { identityHash })}>
            Check identity
          </button>
          <button className="btn btn-soft" type="button" onClick={() => run('credential', { credentialHash })}>
            Check credential
          </button>
          <button
            className="btn btn-soft"
            type="button"
            onClick={() => run('linkage', { identityHash, credentialHash })}
          >
            Check linkage
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => run('full', { identityHash, credentialHash })}
          >
            Full verification
          </button>
        </div>
      </div>
      {result && (
        <div className="panel" style={{ marginTop: 16 }}>
          {result.valid === true && <div className="ok">{result.message || 'Valid'}</div>}
          {result.valid === false && <div className="alert">{result.message || 'Not valid'}</div>}
          <pre className="hash" style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
