import { useEffect, useState } from 'react';
import api from '../api/client';
import { formatDate } from '../lib/format';

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  const load = () => {
    api.get('/notifications').then((res) => {
      setItems(res.data.data || []);
      setUnread(res.data.unreadCount || 0);
    });
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="container page">
      <div className="section-title">
        <h2>Notifications</h2>
        <div className="row">
          <span className="muted">{unread} unread</span>
          <button className="btn btn-soft" type="button" onClick={async () => { await api.put('/notifications/read-all'); load(); }}>
            Mark all read
          </button>
        </div>
      </div>
      {items.length === 0 && <div className="empty">You are all caught up.</div>}
      {items.map((n) => (
        <div key={n._id} className="panel" style={{ marginBottom: 10, opacity: n.read ? 0.65 : 1 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <strong>{n.title}</strong>
              <p className="muted">{n.message}</p>
              <small className="muted">{formatDate(n.createdAt)}</small>
            </div>
            <div className="row">
              {!n.read && (
                <button className="btn btn-ghost" type="button" onClick={async () => { await api.put(`/notifications/${n._id}/read`); load(); }}>
                  Read
                </button>
              )}
              <button className="btn btn-danger" type="button" onClick={async () => { await api.delete(`/notifications/${n._id}`); load(); }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
