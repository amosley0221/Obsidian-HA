// Minimal Home Assistant WebSocket client.
// Connects to /api/websocket, authenticates with a long-lived access token,
// supports get_states, call_service, and event subscriptions. Auto-reconnects.

(function () {
  class HaClient {
    constructor({ url, token, onStateChange, onStatus }) {
      this.url = url.replace(/\/$/, '');
      this.token = token;
      this.onStateChange = onStateChange || (() => {});
      this.onStatus = onStatus || (() => {});
      this.ws = null;
      this.msgId = 1;
      this.pending = new Map();
      this.subscriptions = new Map();
      this._reconnectTimer = null;
      this._stopped = false;
    }

    connect() {
      this._stopped = false;
      const wsUrl = (this.url.startsWith('http://') ? 'ws://' : 'wss://')
                  + this.url.replace(/^https?:\/\//, '')
                  + '/api/websocket';
      this.onStatus('connecting');
      const ws = new WebSocket(wsUrl);
      this.ws = ws;
      ws.addEventListener('message', (ev) => this._onMessage(ev));
      ws.addEventListener('close', () => this._onClose());
      ws.addEventListener('error', () => { /* close will fire too */ });
    }

    stop() {
      this._stopped = true;
      clearTimeout(this._reconnectTimer);
      try { this.ws?.close(); } catch (e) {}
    }

    _onClose() {
      this.onStatus('disconnected');
      this.pending.forEach(({ reject }) => reject(new Error('socket closed')));
      this.pending.clear();
      this.subscriptions.clear();
      if (this._stopped) return;
      this._reconnectTimer = setTimeout(() => this.connect(), 2000);
    }

    _onMessage(ev) {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.type === 'auth_required') {
        this.ws.send(JSON.stringify({ type: 'auth', access_token: this.token }));
        return;
      }
      if (msg.type === 'auth_invalid') {
        this.onStatus('auth_invalid');
        this._stopped = true;
        try { this.ws.close(); } catch (e) {}
        return;
      }
      if (msg.type === 'auth_ok') {
        this.onStatus('connected');
        return;
      }
      if (msg.type === 'event') {
        const sub = this.subscriptions.get(msg.id);
        if (sub) sub(msg.event);
        return;
      }
      if (msg.type === 'result') {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.success) p.resolve(msg.result);
        else p.reject(new Error(msg.error?.message || 'ws error'));
      }
    }

    _send(payload) {
      const id = this.msgId++;
      const message = { id, ...payload };
      return new Promise((resolve, reject) => {
        this.pending.set(id, { resolve, reject });
        try {
          this.ws.send(JSON.stringify(message));
        } catch (e) {
          this.pending.delete(id);
          reject(e);
        }
      });
    }

    callWS(payload) { return this._send(payload); }

    getStates() { return this._send({ type: 'get_states' }); }

    callService(domain, service, serviceData = {}, target = null) {
      const payload = { type: 'call_service', domain, service, service_data: serviceData };
      if (target) payload.target = target;
      return this._send(payload);
    }

    async subscribeEvents(eventType, callback) {
      const id = this.msgId++;
      this.subscriptions.set(id, callback);
      return new Promise((resolve, reject) => {
        this.pending.set(id, { resolve: () => resolve(id), reject });
        try {
          this.ws.send(JSON.stringify({ id, type: 'subscribe_events', event_type: eventType }));
        } catch (e) {
          this.pending.delete(id);
          this.subscriptions.delete(id);
          reject(e);
        }
      });
    }

    async getEntityRegistry() {
      return this._send({ type: 'config/entity_registry/list' });
    }
  }

  window.HaClient = HaClient;
})();
