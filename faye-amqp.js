var Engine = function(server, options) {
	this._server  = server;
	this._options = options || {};
	
	this._clients   = {};
	this._channels  = {};
  	this._messages  = {};

};

Engine.create = function(server, options) {
  return new this(server, options);
};

Engine.prototype = {
  createClient: function(callback, context) {
    //var clientId = this._namespace.generate();
    var clientId = this._server.generateId(), self = this;
    self._server.debug('Created new client ?', clientId);
    self.ping(clientId);
    self._server.trigger('handshake', clientId);
    callback.call(context, clientId);
  },
  
  destroyClient: function(clientId, callback, context) {
    if (!this._namespace.exists(clientId)) return;
    var clients = this._clients;
    
    if (clients[clientId])
      clients[clientId].forEach(function(channel) { this.unsubscribe(clientId, channel) }, this);
    
    this.removeTimeout(clientId);
    this._namespace.release(clientId);
    delete this._messages[clientId];
    this._server.debug('Destroyed client ?', clientId);
    this._server.trigger('disconnect', clientId);
    if (callback) callback.call(context);
  },
  
  clientExists: function(clientId, callback, context) {
    callback.call(context, this._namespace.exists(clientId));
  },
  
  ping: function(clientId) {
    var timeout = this._server.timeout;
    if (typeof timeout !== 'number') return;
    
    this._server.debug('Ping ?, ?', clientId, timeout);
    this.removeTimeout(clientId);
    this.addTimeout(clientId, 2 * timeout, function() {
      this.destroyClient(clientId);
    }, this);
  },
  
  subscribe: function(clientId, channel, callback, context) {
    var clients = this._clients, 
    channels = this._channels;
    
    clients[clientId] = clients[clientId] || new Faye.Set();
    var trigger = clients[clientId].add(channel);
    
    channels[channel] = channels[channel] || new Faye.Set();
    channels[channel].add(clientId);
    
    this._server.debug('Subscribed client ? to channel ?', clientId, channel);
    if (trigger) this._server.trigger('subscribe', clientId, channel);
    if (callback) callback.call(context, true);
  },
  
  unsubscribe: function(clientId, channel, callback, context) {
    var clients  = this._clients,
        channels = this._channels,
        trigger  = false;
    
    if (clients[clientId]) {
      trigger = clients[clientId].remove(channel);
      if (clients[clientId].isEmpty()) delete clients[clientId];
    }
    
    if (channels[channel]) {
      channels[channel].remove(clientId);
      if (channels[channel].isEmpty()) delete channels[channel];
    }
    
    this._server.debug('Unsubscribed client ? from channel ?', clientId, channel);
    if (trigger) this._server.trigger('unsubscribe', clientId, channel);
    if (callback) callback.call(context, true);
  },
  
  publish: function(message, channels) {
    this._server.debug('Publishing message ?', message);

    var messages = this._messages,
        clients  = new Faye.Set(),
        subs;
    
    for (var i = 0, n = channels.length; i < n; i++) {
      subs = this._channels[channels[i]];
      if (!subs) continue;
      subs.forEach(clients.add, clients);
    }
    
    clients.forEach(function(clientId) {
      this._server.debug('Queueing for client ?: ?', clientId, message);
      messages[clientId] = messages[clientId] || [];
      messages[clientId].push(Faye.copyObject(message));
      this.emptyQueue(clientId);
    }, this);
    
    this._server.trigger('publish', message.clientId, message.channel, message.data);
  },
  
  emptyQueue: function(clientId) {
    if (!this._server.hasConnection(clientId)) return;
    this._server.deliver(clientId, this._messages[clientId]);
    delete this._messages[clientId];
  }
};
module.exports = Engine;