class WsClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.isConnected = false;
    this.onMessage = null;
    this.onStatusChange = null;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    try {
      this.ws = new WebSocket(this.url);
    } catch (e) {
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.isConnected = true;
      this.reconnectDelay = 1000;
      this._startHeartbeat();
      this.onStatusChange && this.onStatusChange(true);
      this.onReconnected && this.onReconnected();
    };

    this.ws.onclose = (e) => {
      this.isConnected = false;
      this._stopHeartbeat();
      this.onStatusChange && this.onStatusChange(false);
      if (!e.wasClean) this._scheduleReconnect();
    };

    this.ws.onerror = () => {};

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        this.onMessage && this.onMessage(msg);
      } catch {}
    };
  }

  send(data) {
    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  disconnect() {
    this._stopHeartbeat();
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null; // 阻止自动重连
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'heartbeat', timestamp: Date.now() });
    }, 15000);
  }

  _stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  _scheduleReconnect() {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    }, this.reconnectDelay);
  }
}
